import BlurPostFX from "../pipelines/blur.js";
import SpotlightPostFX from "../pipelines/spotlight.js";
import InteractiveEntity from "../entities/interactive-entity.js";
import Padlock from "../entities/padlock.js";
import Lamp from "../entities/lamp.js";
import MusicPlayer from "../entities/music-player.js";

export default class RoomScene extends Phaser.Scene {
	constructor() {
		super("Room");
	}

	preload() {
		console.log("Preloading assets...");

		this.load.image("background", "assets/background.png");
		this.load.image("glasses", "assets/glasses.png");
		this.load.image("digits", "assets/digits.png");
		this.load.image("padlock", "assets/padlock.png");
		this.load.image("padlock-unlocked", "assets/padlock-unlocked.png");
		this.load.image("lamp", "assets/lamp.png");
		this.load.image("lamp-switch", "assets/lamp-switch.png");

		MusicPlayer.preload(this);
	}

	update_light() {
		this.spotlight.set1f("tx", this.spotlight_settings.position.x / this.background.width);
		this.spotlight.set1f("ty", this.spotlight_settings.position.y / this.background.height);
		this.spotlight.set1f("r", this.spotlight_settings.ray * this.cameras.main.zoom);
		this.spotlight.set2f("resolution", this.game.config.width, this.game.config.height);
	}

	create() {
		console.log("Creating the game...");

		this.musicPlayer = new MusicPlayer(this);

		this.background = this.add.image(0, 0, "background");
		this.background.setOrigin(0, 0);

		this.spotlight = new SpotlightPostFX(this.game);
		this.game.renderer.pipelines.add("Spotlight", this.spotlight);
		this.spotlight_settings = {
			position: { x: 0, y: this.background.height },
			ray: 0.3,
		};
		this.update_light();
		this.background.setPipeline(this.spotlight);

		this.background.scale = 0.7;

		this.isLockedDueToAnimation = false;
		this.isZoomedIn = false;
		this.selectedEntity = null;

		this.createEntities();

		for (const entity of this.entities) {
			this.add.existing(entity);

			entity.on("selected", () => {
				if (this.isLockedDueToAnimation) {
					return;
				}
				if (this.isZoomedIn && this.selectedEntity === entity) {
					this.useEntity(entity);
				} else {
					this.selectEntity(entity);
				}
			});
		}

		this.input.on("pointerdown", (pointer) => {
			if (this.isLockedDueToAnimation) {
				return;
			}
			if (pointer.rightButtonDown() && this.isZoomedIn) {
				this.unselectEntity();
			}
		});

		this.input.mouse.disableContextMenu();

		for (let i = 0; i < 10; i++) {
			this.background.setPostPipeline(BlurPostFX);
		}
		this.cameras.main.setBounds(
			0,
			0,
			this.background.width * this.background.scale,
			this.background.height * this.background.scale
		);
	}

	update() {
		if (!this.selectedEntity) {
			this.cameras.main.pan(
				(game.input.mousePointer.x * this.background.width * this.background.scale) / this.game.config.width,
				(game.input.mousePointer.y * this.background.height * this.background.scale) / this.game.config.height,
				1000,
				"Power1",
				true
			);
		} else {
			this.cameras.main.centerOn(this.selectedEntity.x, this.selectedEntity.y);
		}
		if (this.spotlight_settings) {
			this.update_light();
		}
	}

	createEntities() {
		this.glasses = new InteractiveEntity(this, 100, 1600, "glasses");
		this.glasses.scale = 0.1;

		this.lamp = new Lamp(this, 300, 1500);
		for (let i = 0; i < 10; i++) {
			this.lamp.setPostPipeline(BlurPostFX);
		}

		this.padlock = new Padlock(this, 1700, 1000, "517").setVisible(false);

		this.entities = [this.lamp, this.glasses, this.padlock];
	}

	selectEntity(entity) {
		entity.onSelected();
		this.isZoomedIn = true;
		this.selectedEntity = entity;

		this.isLockedDueToAnimation = true;
		this.cameras.main.zoomTo(3.0, 1000, "Power1", true, (_, progress) => {
			if (progress >= 0.3) {
				this.isLockedDueToAnimation = false;
			}
		});
	}

	useEntity(entity) {
		// Step 1: glasses -> lamp
		if (entity === this.glasses) {
			this.isLockedDueToAnimation = true;
			this.tweens.add({
				targets: this.glasses,
				alpha: 0,
				duration: 500,
				onComplete: () => {
					this.isLockedDueToAnimation = false;

					// Destroy the glasses
					this.glasses.destroy();
					this.selectedEntity = null;
					this.unselectEntity();

					// Remove blur
					this.background.removePostPipeline(BlurPostFX);

					// Play the first music track
					this.musicPlayer.play(1);

					// Show the lamp
					this.lamp.enableInteractivity();
					this.lamp.removePostPipeline(BlurPostFX);
				},
			});
		}

		// Step 2: lamp -> padlock
		if (entity === this.lamp) {
			// Zoom out
			this.unselectEntity();

			// Play the second music track
			this.musicPlayer.play(2);

			// Let there be light
			this.tweens.add({
				targets: this.spotlight_settings,
				ray: 0.8,
				duration: 8500,
				onComplete: () => {
					// Show the padlock
					this.padlock.setAlpha(0).setVisible(true);
					this.tweens.add({
						targets: this.padlock,
						alpha: 1,
						duration: 5000,
					});
				},
			});
		}

		// Step 3: padlock
		if (entity === this.padlock) {
			this.isLockedDueToAnimation = true;
			this.tweens.add({
				targets: this.padlock,
				alpha: 0,
				duration: 500,
				onComplete: () => {
					this.isLockedDueToAnimation = false;

					// Destroy the padlock
					this.padlock.destroy();
					this.selectedEntity = null;
					this.unselectEntity();

					// Let there be light
					this.tweens.add({
						targets: this.spotlight_settings,
						ray: 2,
						duration: 30000,
					});

					// Play the last music track
					this.musicPlayer.play(4);
				},
			});
		}
	}

	unselectEntity() {
		if (this.selectedEntity) {
			this.selectedEntity.onUnselected();
		}

		this.isLockedDueToAnimation = true;
		this.cameras.main.zoomTo(1.0, 1000, "Power1", true, (_, progress) => {
			if (progress >= 0.3) {
				this.isLockedDueToAnimation = false;
				this.isZoomedIn = false;
				this.selectedEntity = null;
			}
		});
	}
}
