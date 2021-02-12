const Bitmex = require("bitmex-node");
const AbortController = require('abort-controller');
const fetch = require('node-fetch');
const TwitterStream = require('twitter-v2/src/TwitterStream.js');
require('dotenv').config()

(async () => {

	//Setup twitterstream
	const abortController = new AbortController();
	let stream = new TwitterStream(
		async () => {
			return fetch("https://api.twitter.com/2/tweets/search/stream", {
				signal: abortController.signal,
				headers: {
					"Content-Type": "application/json",
					"Authorization": "Bearer " + process.env.bearer_token,
				},
			});
		},
		() => {
			abortController.abort();
		}
	);

	//Setup bitmexapi

	const bitmex = new Bitmex.BitmexAPI({
		"apiKeyID": process.env.api_key_id,
		"apiKeySecret": process.env.api_key_secret,
	});



	for await (const { data } of stream) {

		if(typeof data === 'undefined'){
			console.error("Received undefined tweet");
			continue;
		}

		console.log("Tweet received: " + data.text)

		const pos = await bitmex.Position.get();

		let quantity = 0;

		for (var position in pos) {
			console.log("a position:");
			console.log(pos[position].currentQty);
			quantity += pos[position].currentQty;
		}

		if (quantity > 0) {
			console.log("We already have a position");
			continue;
		}

		else if (data.text.includes("doge") || data.text.includes("Ð")) {
			const dogeordr = await bitmex.Order.new({
				symbol: "DOGEUSDT",
				side: "Buy",
				orderQty: 34000,
				orderType: "Market"
			});
			console.log(dogeordr);
		}

		else if (data.text.includes("bitcoin")) {
			const btcordr = await bitmex.Order.new({
				symbol: "XBTUSD",
				side: "Buy",
				orderQty: 181000,
				orderType: "Market"
			});
			console.log(btcordr);
		}



		//check updated positions and place a take profit

		const newPos = await bitmex.Position.get();

		for (var position in newPos) {
			let symb = newPos[position].symbol;
			let qty = newPos[position].currentQty;
			let cost = newPos[position].avgCostPrice;
			console.log("Long " + symb + " x " + qty + " from " + cost);
			//submit limit take-profit
			if (qty > 0) {
				console.log("the new position:");
				console.log(newPos[position]);
				let sellPrice = cost * 1.05;
				console.log("Setting limit take profit at " + sellPrice.toFixed(5));
				try {
					const takeprofit = await bitmex.Order.new({
						symbol: symb,
						side: "Sell",
						orderQty: qty,
						orderType: "Limit",
						price: sellPrice.toFixed(5)
					});
					console.log(takeprofit);
				} catch (err) {
					console.error("Couldn't sell: ");
					console.error(err);
				}
			}
		}
	}

	stream.close();

})();
