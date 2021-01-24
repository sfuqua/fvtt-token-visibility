/**
 * A special CanvasLayer that exists solely to render itself on
 * top of the SightLayer, to reveal tokens under certain criteria.
 */
export class RevealedTokenLayer extends CanvasLayer {
    constructor() {
        super();

        // The sightRefresh hook is invoked by the SightLayer once
        // it has finished updating token visibility based on fog.
        Hooks.on("sightRefresh", (sight: SightLayer) => {
            if (!sight.tokenVision) {
                // This module is a no-op without token vision.
                this.visible = false;
                return;
            }

            this.removeChildren();
            for (const token of canvas.tokens.placeables as Token[]) {
                if (!token.visible && !token.data.hidden) {
                    // If this token has been hidden by a visibility restriction,
                    // evaluate whether draw it on this layer.

                    // We always flag other players as visible
                    const isAnotherPlayer = !!token.actor?.hasPlayerOwner;
                    if (!isAnotherPlayer) {
                        // If it's not a player, we see if any other players can see the token
                        // TODO
                        continue;
                    }

                    // Reveal the token
                    this.addChild(this.buildTokenContainer(token as Token));
                }
            }

            this.visible = true;
        });
    }

    static get layerOptions(): CanvasLayerOptions {
        return mergeObject(SightLayer.layerOptions, {
            zIndex: SightLayer.layerOptions.zIndex + 1,
        } as CanvasLayerOptions);
    }

    /**
     * Builds the icon component of a token as a PIXI Sprite.
     * Based on Token._drawIcon().
     */
    buildTokenIcon(token: Token & { texture?: PIXI.Texture }): { sprite: PIXI.Sprite; texture?: PIXI.Texture } {
        const icon = new PIXI.Sprite(token.texture);
        icon.anchor.set(0.5, 0.5);
        if (!token.texture) {
            return { sprite: icon };
        }

        icon.tint = token.data.tint ? colorStringToHex(token.data.tint) : 0xffffff;
        return { sprite: icon, texture: token.texture };
    }

    /**
     * Given a Token, clones it as a new PIXI Container for rendering into this layer.
     * This is almost entirely based on Token.refresh().
     */
    buildTokenContainer(token: Token): PIXI.Container {
        const tokenClone = new PIXI.Container();
        const { sprite, texture } = this.buildTokenIcon(token);
        tokenClone.addChild(sprite);
        tokenClone.position.set(token.data.x, token.data.y);
        if (texture) {
            const aspect = texture.width / texture.height;
            if (aspect >= 1) {
                sprite.width = token.w * token.data.scale;
                sprite.scale.y = sprite.scale.x;
            } else {
                sprite.height = token.h * token.data.scale;
                sprite.scale.x = sprite.scale.y;
            }
        }

        // Mirror horizontally or vertically
        sprite.scale.x = Math.abs(sprite.scale.x) * (token.data.mirrorX ? -1 : 1);
        sprite.scale.y = Math.abs(sprite.scale.y) * (token.data.mirrorY ? -1 : 1);

        // Set rotation, position, and opacity
        // TODO: Decide whether we want to track rotation in the fog or not
        // sprite.rotation = toRadians(token.data.lockRotation ? 0 : token.data.rotation);
        sprite.position.set(token.w / 2, token.h / 2);

        // Revealed tokens will be at 50% opacity
        sprite.alpha = 0.5;

        sprite.visible = true;
        tokenClone.visible = true;
        return tokenClone;
    }
}
