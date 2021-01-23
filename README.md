# Foundry VTT Shared Token Visibility

"Shared Token Visibility" is a [Foundry VTT](https://foundryvtt.com/) module that aims to provide a compromise between per-player dynamic lighting and out-of-character coordination.

The goal of this module is to let the GM restrict dynamic lighting per character (**not** providing "Observer" visibility to every token), but allowing players to see each other's positions in a scene as well as the positions of NPCs and monsters that one of their party members sees.

This way, during a party split - or just when half the party is hiding behind a corner - players don't miss out on cool reveals or get tactically hamstrung by the lighting system.

To accomplish this, the module has exactly one feature: if any player in your game can see a token, that token is revealed to every other player.

## Installation

Load the following manifest into Foundry: https://raw.githubusercontent.com/sfuqua/fvtt-token-visibility/master/module.json
