/**
 * Handles brokering control of Tokens between the TokenLayer and RevealedTokenLayer.
 */
export interface TokenBroker {
    /**
     * Takes ownership of a token on the TokenLayer.
     * The token will exist on the layer but should no longer be visible.
     */
    acquire(token: Token): void;

    /**
     * Resets a token so that the TokenLayer owns it again.
     */
    release(token: Token): void;

    /**
     * Resets a token by its ID.
     */
    releaseById(tokenId: string): void;

    /**
     * Releases all tokens.
     */
    releaseAll(): void;
}

export const ACQUIRE_KEY = Symbol("AcquireProxy");
export const RELEASE_KEY = Symbol("ReleaseProxy");
export type ProxiedToken = Token & {
    [ACQUIRE_KEY]: () => void;
    [RELEASE_KEY]: () => void;
};

/**
 * Manages access to tokens using Foundry globals.
 */
export class FvttTokenBroker implements TokenBroker {
    readonly originalCreateToken: (data: unknown) => Token;
    readonly proxies: Map<string, Token>;

    constructor() {
        this.proxies = new Map();

        this.originalCreateToken = canvas.tokens.createObject;
        Object.defineProperty(canvas.tokens, "createObject", {
            configurable: true,
            writable: true,
            value: (data: unknown) => {
                const originalToken = this.originalCreateToken(data);
                const proxy = new Proxy(originalToken, {
                    get: (target, prop, receiver) => {
                        // TODO: Only trap this if it's a proxied token
                        // TODO: Trap opacity? Make orig token transparent while trapped?
                        if (prop === "visible") {
                            return true;
                        }

                        return Reflect.get(target, prop, receiver);
                    },

                    set: (target, prop, value, receiver) => {
                        if (prop !== "visible") {
                            const clone = this.proxies.get(target.id);
                            if (clone) {
                                Reflect.set(clone, prop, value, clone);
                            }
                        }

                        return Reflect.set(target, prop, value, receiver);
                    },

                    defineProperty: (target, key, desc) => {
                        const clone = this.proxies.get(target.id);
                        if (clone) {
                            Reflect.defineProperty(clone, key, desc);
                        }

                        return Reflect.defineProperty(target, key, desc);
                    },

                    deleteProperty: (target, key) => {
                        const clone = this.proxies.get(target.id);
                        if (clone) {
                            Reflect.deleteProperty(clone, key);
                        }

                        return Reflect.deleteProperty(target, key);
                    },
                });

                return proxy;
            },
        });
        canvas.tokens.createObject;
    }

    acquire(token: Token): void {
        if (this.proxies.has(token.id)) {
            return;
        }

        this.proxies.set(token.id, token.clone() as Token);
    }

    release(token: Token): void {
        this.releaseById(token.id);
    }

    releaseById(tokenId: string): void {
        if (!this.proxies.has(tokenId)) {
            return;
        }

        this.proxies.delete(tokenId);
    }

    releaseAll(): void {
        this.proxies.clear();
    }
}
