// Node 24 lacks Uint8Array's base64 methods, which Workers have (photos.ts uses
// them). Loaded by the unit tests (vite.config.ts) and the dev server
// (hooks.server.ts), which run on Node; never in the deployed Worker.
Uint8Array.fromBase64 ??= (s: string) => new Uint8Array(Buffer.from(s, 'base64'));
Uint8Array.prototype.toBase64 ??= function (this: Uint8Array) {
	return Buffer.from(this).toString('base64');
};
