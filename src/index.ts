/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
	DEV_ENVIRONMENT: "Production";
}

function fix(headers: Headers, origin: string
	| null, requestMethod: string
	| null, requestHeader: string
	| null, isOptions: boolean = false) {
	if (origin) {
		headers.set("Access-Control-Allow-Origin", origin);
	}
	if (isOptions) {
		if (requestMethod) {
			headers.set("Access-Control-Allow-Methods", requestMethod);
		}
		if (requestHeader) {
			headers.set("Access-Control-Allow-Headers", requestHeader)
		}
		headers.delete("X-Content-Type-Options");
	}
	return headers;
}

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {

		console.dir(JSON.stringify(request))
		const isOptions = request.method === "OPTIONS";
		const originUrl = new URL(request.url);
		const origin = request.headers.get("Origin");

		const fetchUrl = decodeURIComponent(decodeURIComponent(originUrl.search.substr(1)));

		let xHeaders = request.headers.get("x-cors-headers");
		if (xHeaders != null) {
			try {
				xHeaders = JSON.parse(xHeaders);
			} catch (e) {
				// ignore
			}
		}

		let recvHeaders:any = {};

		if (originUrl.search.startsWith("?")) {
			for (let pair of request.headers.entries()) {
				if ((pair[0].match("^origin") == null) &&
					(pair[0].match("eferer") == null) &&
					(pair[0].match("^cf-") == null) &&
					(pair[0].match("^x-forw") == null) &&
					(pair[0].match("^x-cors-headers") == null)
				) recvHeaders[pair[0]] = pair[1];
			}
		}

		if (xHeaders != null) {
			Object.entries(xHeaders).forEach((c)=>recvHeaders[c[0]] = c[1]);
		}

		const cookie = request.headers.get("Cookie")
		if (cookie) {
			recvHeaders["Cookie"] = cookie;
		}

		const host = request.headers.get("Host");
		if (host) {
			recvHeaders["Host"] = host;
		}

		let newRequest = new Request(request, {
			redirect: "follow",
			headers: recvHeaders
		})

		let response = await fetch(fetchUrl, newRequest as any);
		let myHeaders = new Headers(response.headers);
		let corsHeaders = [];
		let allHeaders: any = {};

		for(let pair of response.headers.entries()) {
			corsHeaders.push(pair[0]);
			allHeaders[pair[0]] = pair[1];
		}

		corsHeaders.push("cors-received-headers");

		myHeaders = fix(myHeaders, origin,
			request.headers.get("access-control-request-method"),
			request.headers.get("access-control-request-headers"), isOptions)

		myHeaders.set("Access-Control-Expose-Headers", corsHeaders.join(""));
		myHeaders.set("cors-received-headers", JSON.stringify(allHeaders))

		let body: ArrayBuffer|null = null;

		if (!isOptions) {
			body = await response.arrayBuffer();
		}

		let init = {
			headers: myHeaders,
			status: (isOptions ? 200 : response.status),
			statusText: (isOptions ? "OK" : response.statusText)
		};

		return new Response(body, init);
	},
};
