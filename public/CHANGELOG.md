## [0.0.5] - 2019-12-23
### Fixed
- Only stack equippable items if they are consumed on attack
- Exodium can now be picked up
- An error sending player stats when switching bodies that prevented some of the equipment a player had on from showing.
- Display depth of important_text. Previously, it was showing under the top of walls. Now it shows above them.

### Added
- Result message when trying to equip something normally, but an auto doc is required

## [0.0.4] - 2019-12-22
### Fixed
- Melee attack skill not incrementing on a range 1 attack when the player had no equipment.

## [0.0.3] - 2019-12-22
### Fixed
- Bug that prevented eating from working

## [0.0.2] - 2019-12-22

### Added
- MLM bodies can now eat batteries for HP regeneration
- Added in a deep rock floor tileset for mountain planet levels -1 and lower. Drawn by UnfuneralOD

### Changed
- Machine world size increased from 20 tile to 30 tiles
- Circuitry spawn changed from common to rare
- Auto generated stairs and hole on planets are now using new sprites by UnfuneralOD
- Changed the rock floor tileset to new sprites drawn by UnfuneralOD

### Fixed
- Corrected the sprite for the cutter before we have the animation.

## [0.0.1] - 2019-12-21
### Added 
- Changelog. Space Abyss is coming along nicely, and I think it would be neat to start to have a better record of the changes happening to the game.
- Corporation walls, so corporation planets are no longer using dirt walls as a placeholder (which looks awful)
- Cracked city floor tiles, and added them to corporation planets when they generate.
- Power cell. More energy storage than a battery. Added it to the drop linkers of various monsters.
- Mini drone. Spawns on machine planets.
- Lots of other changes prior to starting to keep track of things

### Changed
- New placeholder sprite for the Warmind
- New placeholder sprite for the DDrone
- Updated the placeholder machine wall sprites to our new format

### Fixed
- Editing in reasons and rarity for the things monsters drop
- You can now stop attacking an npc ( but it won't stop them attacking you back)