/**
 * Fight System Scanner
 *
 * Escanea el sistema de fights de A-Z para detectar:
 * - Inconsistencias de estado
 * - Race conditions
 * - Datos huérfanos
 * - Violaciones de anti-cheat no aplicadas
 *
 * @see docs/Agents/Fight-Enginer-Scanner.md
 */

import { prisma, FightStatus } from '@tfc/db';
import { createLogger } from '@tfc/logger';

const logger = createLogger({ service: 'job' });

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface ScanResult {
  category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  description: string;
  fightId?: string;
  details?: Record<string, unknown>;
  recommendation?: string;
}

interface ScanReport {
  timestamp: Date;
  totalIssues: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  results: ScanResult[];
  summary: string;
}

// ─────────────────────────────────────────────────────────────
// SCANNER FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * 1. Detectar fights donde el winner tiene MENOR PnL que el perdedor
 */
async function scanIncorrectWinners(): Promise<ScanResult[]> {
  const results: ScanResult[] = [];

  const fights = await prisma.fight.findMany({
    where: {
      status: FightStatus.FINISHED,
      winnerId: { not: null },
      isDraw: false,
    },
    include: {
      participants: true,
    },
  });

  for (const fight of fights) {
    const participantA = fight.participants.find((p) => p.slot === 'A');
    const participantB = fight.participants.find((p) => p.slot === 'B');

    if (!participantA || !participantB) continue;

    const pnlA = Number(participantA.finalPnlPercent || 0);
    const pnlB = Number(participantB.finalPnlPercent || 0);

    const winner = fight.participants.find((p) => p.userId === fight.winnerId);
    const loser = fight.participants.find((p) => p.userId !== fight.winnerId);

    if (winner && loser) {
      const winnerPnl = Number(winner.finalPnlPercent || 0);
      const loserPnl = Number(loser.finalPnlPercent || 0);

      // El winner debería tener MAYOR PnL
      if (winnerPnl < loserPnl - 0.0001) {
        results.push({
          category: 'INCORRECT_WINNER',
          severity: 'CRITICAL',
          description: `Winner has LOWER PnL than loser`,
          fightId: fight.id,
          details: {
            winnerId: fight.winnerId,
            winnerPnl,
            loserId: loser.userId,
            loserPnl,
            difference: loserPnl - winnerPnl,
          },
          recommendation: 'Investigar race condition en settlement. Ver logs de fight-engine y reconcile-fights.',
        });
      }
    }
  }

  return results;
}

/**
 * 2. Detectar fights FINISHED que tienen violation NO_CONTEST
 */
async function scanMismatchedViolations(): Promise<ScanResult[]> {
  const results: ScanResult[] = [];

  const violations = await prisma.antiCheatViolation.findMany({
    where: {
      actionTaken: 'NO_CONTEST',
    },
    include: {
      fight: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  for (const violation of violations) {
    if (violation.fight.status === FightStatus.FINISHED) {
      results.push({
        category: 'VIOLATION_NOT_APPLIED',
        severity: 'CRITICAL',
        description: `Fight marked FINISHED but has NO_CONTEST violation: ${violation.ruleCode}`,
        fightId: violation.fightId,
        details: {
          ruleCode: violation.ruleCode,
          ruleName: violation.ruleName,
          message: violation.ruleMessage,
          fightStatus: violation.fight.status,
        },
        recommendation: 'El estado del fight fue sobrescrito DESPUÉS de que anti-cheat determinó NO_CONTEST.',
      });
    }
  }

  return results;
}

/**
 * 3. Detectar fights LIVE que ya deberían haber terminado
 */
async function scanOverdueLiveFights(): Promise<ScanResult[]> {
  const results: ScanResult[] = [];
  const now = Date.now();
  const GRACE_PERIOD_MS = 60000; // 1 minuto de gracia

  const liveFights = await prisma.fight.findMany({
    where: {
      status: FightStatus.LIVE,
      startedAt: { not: null },
    },
  });

  for (const fight of liveFights) {
    if (!fight.startedAt) continue;

    const expectedEndTime = fight.startedAt.getTime() + fight.durationMinutes * 60 * 1000;
    const overdueMs = now - expectedEndTime;

    if (overdueMs > GRACE_PERIOD_MS) {
      const overdueMinutes = Math.floor(overdueMs / 60000);

      results.push({
        category: 'OVERDUE_LIVE_FIGHT',
        severity: overdueMs > 300000 ? 'CRITICAL' : 'HIGH', // > 5 min = crítico
        description: `Fight still LIVE ${overdueMinutes} minutes after expected end`,
        fightId: fight.id,
        details: {
          startedAt: fight.startedAt,
          expectedEndTime: new Date(expectedEndTime),
          overdueMinutes,
          durationMinutes: fight.durationMinutes,
        },
        recommendation: 'Verificar que realtime service y reconcile-fights job están corriendo.',
      });
    }
  }

  return results;
}

/**
 * 4. Detectar participantes con scores pero fight no terminado
 */
async function scanPartialSettlement(): Promise<ScanResult[]> {
  const results: ScanResult[] = [];

  const participants = await prisma.fightParticipant.findMany({
    where: {
      OR: [
        { finalPnlPercent: { not: null } },
        { finalScoreUsdc: { not: null } },
      ],
      fight: {
        status: FightStatus.LIVE,
      },
    },
    include: {
      fight: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  for (const participant of participants) {
    results.push({
      category: 'PARTIAL_SETTLEMENT',
      severity: 'HIGH',
      description: `Participant has final scores but fight is still LIVE`,
      fightId: participant.fightId,
      details: {
        userId: participant.userId,
        finalPnlPercent: participant.finalPnlPercent,
        finalScoreUsdc: participant.finalScoreUsdc,
        fightStatus: participant.fight.status,
      },
      recommendation: 'El proceso de settlement se interrumpió después de actualizar participantes pero antes de actualizar fight.',
    });
  }

  return results;
}

/**
 * 5. Detectar participantes sin scores en fights terminados
 */
async function scanMissingScores(): Promise<ScanResult[]> {
  const results: ScanResult[] = [];

  const participants = await prisma.fightParticipant.findMany({
    where: {
      finalPnlPercent: null,
      fight: {
        status: { in: [FightStatus.FINISHED, FightStatus.NO_CONTEST] },
      },
    },
    include: {
      fight: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  for (const participant of participants) {
    results.push({
      category: 'MISSING_FINAL_SCORES',
      severity: 'MEDIUM',
      description: `Fight ended but participant has no final scores`,
      fightId: participant.fightId,
      details: {
        userId: participant.userId,
        fightStatus: participant.fight.status,
      },
      recommendation: 'El settlement no calculó/guardó los scores correctamente.',
    });
  }

  return results;
}

/**
 * 6. Detectar discrepancia en tradesCount
 */
async function scanTradesCountMismatch(): Promise<ScanResult[]> {
  const results: ScanResult[] = [];

  // Agrupar trades por fight y usuario
  const tradeCounts = await prisma.fightTrade.groupBy({
    by: ['fightId', 'participantUserId'],
    _count: {
      id: true,
    },
  });

  const tradeCountMap = new Map<string, number>();
  for (const tc of tradeCounts) {
    const key = `${tc.fightId}:${tc.participantUserId}`;
    tradeCountMap.set(key, tc._count.id);
  }

  // Comparar con tradesCount en participants
  const participants = await prisma.fightParticipant.findMany({
    where: {
      tradesCount: { gt: 0 },
      fight: {
        status: { in: [FightStatus.FINISHED, FightStatus.NO_CONTEST] },
      },
    },
    include: {
      fight: {
        select: { id: true },
      },
    },
  });

  for (const p of participants) {
    const key = `${p.fightId}:${p.userId}`;
    const actualCount = tradeCountMap.get(key) || 0;
    const recordedCount = p.tradesCount || 0;

    if (actualCount !== recordedCount) {
      results.push({
        category: 'TRADES_COUNT_MISMATCH',
        severity: 'MEDIUM',
        description: `Participant tradesCount doesn't match actual trades`,
        fightId: p.fightId,
        details: {
          userId: p.userId,
          recordedCount,
          actualCount,
          difference: actualCount - recordedCount,
        },
        recommendation: 'Los trades se registraron después del settlement o hubo error en cálculo.',
      });
    }
  }

  return results;
}

/**
 * 7. Detectar múltiples violations en < 1 segundo (posible race condition)
 */
async function scanRaceConditionIndicators(): Promise<ScanResult[]> {
  const results: ScanResult[] = [];

  // Obtener todas las violations ordenadas por fight y tiempo
  const violations = await prisma.antiCheatViolation.findMany({
    orderBy: [
      { fightId: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  // Agrupar por fightId
  const byFight = new Map<string, typeof violations>();
  for (const v of violations) {
    if (!byFight.has(v.fightId)) {
      byFight.set(v.fightId, []);
    }
    byFight.get(v.fightId)!.push(v);
  }

  // Buscar violations muy cercanas en tiempo
  for (const [fightId, fightViolations] of byFight) {
    if (fightViolations.length < 2) continue;

    for (let i = 1; i < fightViolations.length; i++) {
      const prev = fightViolations[i - 1]!;
      const curr = fightViolations[i]!;
      const diffMs = curr.createdAt.getTime() - prev.createdAt.getTime();

      // Si hay dos violations del MISMO tipo en < 100ms, es sospechoso
      if (prev.ruleCode === curr.ruleCode && diffMs < 100) {
        results.push({
          category: 'RACE_CONDITION_INDICATOR',
          severity: 'HIGH',
          description: `Duplicate violations logged within ${diffMs}ms - possible race condition`,
          fightId,
          details: {
            ruleCode: curr.ruleCode,
            firstAt: prev.createdAt,
            secondAt: curr.createdAt,
            diffMs,
          },
          recommendation: 'Múltiples servicios procesaron el mismo fight simultáneamente.',
        });
      }
    }
  }

  return results;
}

/**
 * 8. Detectar snapshots después de endedAt
 */
async function scanOrphanedSnapshots(): Promise<ScanResult[]> {
  const results: ScanResult[] = [];

  const fights = await prisma.fight.findMany({
    where: {
      status: { in: [FightStatus.FINISHED, FightStatus.NO_CONTEST] },
      endedAt: { not: null },
    },
    select: {
      id: true,
      endedAt: true,
    },
  });

  for (const fight of fights) {
    if (!fight.endedAt) continue;

    const lateSnapshots = await prisma.fightSnapshot.count({
      where: {
        fightId: fight.id,
        timestamp: {
          gt: new Date(fight.endedAt.getTime() + 5000), // 5 segundos de gracia
        },
      },
    });

    if (lateSnapshots > 0) {
      results.push({
        category: 'ORPHANED_SNAPSHOTS',
        severity: 'LOW',
        description: `${lateSnapshots} snapshots recorded after fight ended`,
        fightId: fight.id,
        details: {
          endedAt: fight.endedAt,
          lateSnapshotsCount: lateSnapshots,
        },
        recommendation: 'Tick loop continuó escribiendo snapshots después del settlement.',
      });
    }
  }

  return results;
}

/**
 * 9. Estadísticas generales del sistema
 */
async function scanSystemStats(): Promise<ScanResult[]> {
  const results: ScanResult[] = [];

  const [
    totalFights,
    liveFights,
    waitingFights,
    finishedFights,
    noContestFights,
    cancelledFights,
    totalViolations,
    noContestViolations,
  ] = await Promise.all([
    prisma.fight.count(),
    prisma.fight.count({ where: { status: FightStatus.LIVE } }),
    prisma.fight.count({ where: { status: FightStatus.WAITING } }),
    prisma.fight.count({ where: { status: FightStatus.FINISHED } }),
    prisma.fight.count({ where: { status: FightStatus.NO_CONTEST } }),
    prisma.fight.count({ where: { status: FightStatus.CANCELLED } }),
    prisma.antiCheatViolation.count(),
    prisma.antiCheatViolation.count({ where: { actionTaken: 'NO_CONTEST' } }),
  ]);

  results.push({
    category: 'SYSTEM_STATS',
    severity: 'INFO',
    description: 'System-wide fight statistics',
    details: {
      totalFights,
      liveFights,
      waitingFights,
      finishedFights,
      noContestFights,
      cancelledFights,
      totalViolations,
      noContestViolations,
      noContestRate: totalFights > 0
        ? ((noContestFights / (finishedFights + noContestFights)) * 100).toFixed(2) + '%'
        : '0%',
    },
  });

  // Alerta si hay muchos fights LIVE
  if (liveFights > 10) {
    results.push({
      category: 'HIGH_LIVE_FIGHTS',
      severity: 'MEDIUM',
      description: `Unusually high number of LIVE fights: ${liveFights}`,
      details: { liveFights },
      recommendation: 'Verificar que el sistema está procesando fights correctamente.',
    });
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// MAIN SCANNER
// ─────────────────────────────────────────────────────────────

/**
 * Ejecutar escaneo completo del sistema de fights
 */
export async function runFightSystemScan(): Promise<ScanReport> {
  const startTime = Date.now();

  logger.info('FIGHT_SCAN_START', 'Starting fight system scan');

  const allResults: ScanResult[] = [];

  // Ejecutar todos los escaneos
  const scanners = [
    { name: 'Incorrect Winners', fn: scanIncorrectWinners },
    { name: 'Mismatched Violations', fn: scanMismatchedViolations },
    { name: 'Overdue Live Fights', fn: scanOverdueLiveFights },
    { name: 'Partial Settlement', fn: scanPartialSettlement },
    { name: 'Missing Scores', fn: scanMissingScores },
    { name: 'Trades Count Mismatch', fn: scanTradesCountMismatch },
    { name: 'Race Condition Indicators', fn: scanRaceConditionIndicators },
    { name: 'Orphaned Snapshots', fn: scanOrphanedSnapshots },
    { name: 'System Stats', fn: scanSystemStats },
  ];

  for (const scanner of scanners) {
    try {
      const results = await scanner.fn();
      allResults.push(...results);
      logger.info('FIGHT_SCAN_PROGRESS', `Completed: ${scanner.name}`, {
        issuesFound: results.length,
      });
    } catch (error) {
      logger.error('FIGHT_SCAN_ERROR', `Scanner failed: ${scanner.name}`, error as Error);
      allResults.push({
        category: 'SCANNER_ERROR',
        severity: 'HIGH',
        description: `Scanner "${scanner.name}" failed with error`,
        details: {
          scanner: scanner.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  // Contar por severidad
  const criticalCount = allResults.filter((r) => r.severity === 'CRITICAL').length;
  const highCount = allResults.filter((r) => r.severity === 'HIGH').length;
  const mediumCount = allResults.filter((r) => r.severity === 'MEDIUM').length;
  const lowCount = allResults.filter((r) => r.severity === 'LOW').length;

  const duration = Date.now() - startTime;

  const report: ScanReport = {
    timestamp: new Date(),
    totalIssues: allResults.length - 1, // -1 for SYSTEM_STATS which is INFO
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    results: allResults,
    summary: `Scan completed in ${duration}ms. Found: ${criticalCount} CRITICAL, ${highCount} HIGH, ${mediumCount} MEDIUM, ${lowCount} LOW issues.`,
  };

  logger.info('FIGHT_SCAN_COMPLETE', 'Fight system scan completed', {
    duration,
    totalIssues: report.totalIssues,
    criticalCount,
    highCount,
  });

  return report;
}

/**
 * Formatear reporte para consola
 */
export function formatReportForConsole(report: ScanReport): string {
  const lines: string[] = [];

  lines.push('═'.repeat(70));
  lines.push('FIGHT SYSTEM SCAN REPORT');
  lines.push('═'.repeat(70));
  lines.push(`Timestamp: ${report.timestamp.toISOString()}`);
  lines.push(`Total Issues: ${report.totalIssues}`);
  lines.push('');
  lines.push('SEVERITY BREAKDOWN:');
  lines.push(`  🔴 CRITICAL: ${report.criticalCount}`);
  lines.push(`  🟠 HIGH:     ${report.highCount}`);
  lines.push(`  🟡 MEDIUM:   ${report.mediumCount}`);
  lines.push(`  🟢 LOW:      ${report.lowCount}`);
  lines.push('');

  if (report.criticalCount > 0 || report.highCount > 0) {
    lines.push('─'.repeat(70));
    lines.push('CRITICAL & HIGH SEVERITY ISSUES:');
    lines.push('─'.repeat(70));

    for (const result of report.results) {
      if (result.severity !== 'CRITICAL' && result.severity !== 'HIGH') continue;

      const emoji = result.severity === 'CRITICAL' ? '🔴' : '🟠';
      lines.push('');
      lines.push(`${emoji} [${result.severity}] ${result.category}`);
      lines.push(`   Description: ${result.description}`);
      if (result.fightId) {
        lines.push(`   Fight ID: ${result.fightId}`);
      }
      if (result.details) {
        lines.push(`   Details: ${JSON.stringify(result.details, null, 2).split('\n').join('\n   ')}`);
      }
      if (result.recommendation) {
        lines.push(`   💡 Recommendation: ${result.recommendation}`);
      }
    }
  }

  lines.push('');
  lines.push('═'.repeat(70));
  lines.push(report.summary);
  lines.push('═'.repeat(70));

  return lines.join('\n');
}

// Export para uso directo
export type { ScanResult, ScanReport };
