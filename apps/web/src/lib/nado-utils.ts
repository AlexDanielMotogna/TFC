/**
 * Shared Nado utilities used by both server-side adapter and client-side WS adapter.
 * Keep this file free of server-only imports (no Node.js built-ins like Buffer, crypto, etc.)
 * so it can be safely imported from client components.
 */

/**
 * Encode an EVM address + subaccount name into a bytes32 subaccount ID.
 * Format: 20-byte address + 12-byte name (right-padded with zeros).
 *
 * Uses TextEncoder (browser-safe) instead of Node's Buffer.
 */
export function addressToSubaccount(address: string, name: string = 'default'): string {
  const addr = address.toLowerCase().replace('0x', '');
  const nameHex = Array.from(new TextEncoder().encode(name))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .padEnd(24, '0');
  return '0x' + addr + nameHex;
}

/**
 * Extract the wallet address from a subaccount bytes32.
 */
export function subaccountToAddress(subaccount: string): string {
  const hex = subaccount.replace('0x', '');
  return '0x' + hex.slice(0, 40);
}
