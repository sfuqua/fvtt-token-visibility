declare class SightLayer extends CanvasLayer {
    static get layerOptions(): CanvasLayerOptions;

    get sources(): Collection;
    get tokenVision(): boolean;
}
