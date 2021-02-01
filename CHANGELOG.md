# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.2.1 - 2020/02/01

### Fixed

-   Disabled hook debug spew. Oops!

## 0.2.0 - 2020/01/26

### Added

-   Token bars and effects are now rendered in addition to the icon.
-   The module now has settings:
    1. You can now opt out of sharing NPC token visibility (making this module only share player tokens).
    2. You can now enable shared _vision_ between all players. When this is active as a GM, clicking a player will show you combined player vision.

### Fixed

-   Token orientation is now correct.
-   Token visibility is correct when a player first connects to the game without needing to move around first.

## 0.1.0 - 2021/01/24

### Added

First end-to-end version of the module for internal testing. The module now uses the Foundry websocket to synchronize visibility state between clients.

## 0.0.1 - 2021/01/23

### Added

Initial module version while in development, with the following features:

-   A new CanvasLayer called `RevealedTokenLayer`
    -   The RevealedTokenLayer draws right above the SightLayer
    -   As of this release, it draws token icons of other players if they are out-of-LOS for the current user
