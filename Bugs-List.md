Todo in Trade fight club to solve all the bugs

1.We noticed if a order is open pre-match and I flip the order it counts as a transaction in the match. This should not be counted as transaction. 

2.Flip, Market, Limit should count only for the transactions made in the match. If we have a pre-open transactionon BTC and we long for examples in the match BTC and then we sell in Limit 20%, we can only take in consideration the part sold from the transaction made in the Fight...Same for Market, Flip And Limit

3.The PNL we calculate the PNL of all transaccitions made in the Fight.. In a easy way not complicated.. Also making sure that we show to the user how much was the fees and how much he earned.. 

4.Token shows wrong Laverage informacion example. This is even in match or normal trading


Token	Size	Position Value	Entry Price	Mark Price	PnL (ROI%)	Liq Price	Margin	Funding	TP/SL	Close
AVAX20x Long										


Real leverage is 5!! This is because is taking the infoaccount of pacifica where the leverage is set to 20X

bf56654f-64da-4315-b63d-1cac2d69977b	61e4d8e7-0ab6-437e-b98a-ee049970cbcf	b7f48d15-657d-4d81-b738-8f05889856a8	104466650	2770090467	AVAX	BUY	0.92000000	14.52200000	0.00935200	-0.00935200	2026-01-13 21:11:25.247	2026-01-13 21:11:25.248	5

5.Position, Open Orders, Trades and History should use always websockets in match or normal trading to have the info as fast as posible in the interface. Traders need info very fast! 

6. In the live card in arena, if the match is live the card should show the result live! 


Important. We need to run some test simulating transactions and making sure that the "analyzer" or the program that calculates results in the fights is working perfectly without mistakes. 
We need also to create a document before to start fixing those issue with all the tasks and you have to update every task done and mark it as done!

We need tests for every task

For now those are the Bugs I know, I will try to find more