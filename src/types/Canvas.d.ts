declare class Canvas {
    readonly app: PIXI.Application;
    readonly stage: PIXI.Container;

    readonly sight: SightLayer;
    readonly tokens: TokenLayer;

    static get layers(): {
        background: BackgroundLayer; // 0
        tiles: TilesLayer; // 10
        drawings: DrawingsLayer; // 20
        grid: GridLayer; // 30
        walls: WallsLayer; // 40
        templates: TemplateLayer; // 50
        notes: NotesLayer; // 60
        tokens: TokenLayer; // 100
        lighting: LightingLayer; // 200
        sounds: SoundsLayer; // 200
        sight: SightLayer; // 210
        effects: EffectsLayer; // 300
        controls: ControlsLayer; // 400
    };

    get layers(): CanvasLayer[];
}
