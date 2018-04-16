import R from 'ramda';
import { CANVAS } from '../index';
import Player from '../objects/Player';
import Hostiles from '../objects/Hostiles';
import Immovables from '../objects/Immovables';
import ParallaxTile from '../objects/ParallaxTile';
import DebugText from '../objects/DebugText';
import Cockpit from '../objects/Cockpit';
import MissionService, { DEFAULT_GRID } from '../services/MissionService';

require('../plugins/virtual-gamepad.js');

export const GAMEPAD = {
	SIZE: 100,
	PADDING: 120
};

const ENERGY_COST = {
	LASER: 0.05,
	THRUST: 0.01
};

const getRandomCoords = (maxX, maxY) => {
	return {
		x: Math.round(Math.random() * maxX),
		y: Math.round(Math.random() * maxY)
	}
}

const doPerSecondProbably = (func, delta, callsPerSecondCount = 1) => {
	if (Math.random() < callsPerSecondCount * delta) {
		func();
	}
}

class Main extends Phaser.State {

	constructor() {
		super();
		// this._state = {
		// 	...DEFAULT_STATE
		// };
	}

	preload() {
		this.game.time.advancedTiming = true;
	}

	create() {
		this.game.physics.startSystem(Phaser.Physics.ARCADE);

    this.setMissionObjectives();
    this.resetMission();

    this.initUserInputControls();

    this.initBackground();

		// Add the player
		this._player = new Player(this.game, {
			keyboard: this.keyboard,
			joystick: this._joystick,
			fireButton: this._fireButton
		});
		this._player.spawn();

		// TODO: Should belong in Player.js
		// Add some lasers for the player
    this.lasers = this.game.add.group();
    this.lasers.enableBody = true;
    this.lasers.physicsBodyType = Phaser.Physics.ARCADE;
    this.lasers.createMultiple(20, 'laser');
    this.lasers.setAll('scale.x', 0.5);
    this.lasers.setAll('scale.y', 0.5);
    this.lasers.setAll('anchor.x', 0.5);
    this.lasers.setAll('anchor.y', 0.5);
		this.laserTime = 0;

		// Add some enemies
		this._hostiles = new Hostiles(this.game, this._missionObjectives.hostiles);

		this.__emitterBloodSplatter = this.game.add.emitter(0, 0, 1000);
		this.__emitterBloodSplatter.makeParticles(['blood_splatter_yellow', 'blood_splatter_green']);
		this.__emitterBloodSplatter.lifespan = 200;
		this.__emitterBloodSplatter.maxParticleSpeed = new Phaser.Point(50, 50);
		this.__emitterBloodSplatter.minParticleSpeed = new Phaser.Point(-50, -50);
		this.__emitterBloodSplatter.maxParticleScale = 2;
		this.__emitterBloodSplatter.minParticleScale = 0.5;
		this.__emitterBloodSplatter.alpha = 0.25;

		// Camera to follow the player
		this.game.camera.follow(this._player.cameraSprite, Phaser.Camera.FOLLOW_LOCKON, 0.1, 0.1);

    this._mission = new MissionService(this.game, {
			player: this._player,
			hostiles: this._hostiles,
      objectives: this._missionObjectives
		});

		// Bring last parallax bg in front of player
		R.last(this._parallax).tileSprite.bringToTop();
		this.game.world.bringToTop(this._mission.immovables.spriteGroup);
    this.game.world.bringToTop(this._mission.immovables.spriteGroup);

		this._cockpit = new Cockpit(this.game, {
			player: this._player,
			hostiles: this._hostiles,
      objectives: this._missionObjectives,
      immovables: this._mission.immovables
    });

		// Display console - debug
		this._debugText = new DebugText(this.game, {
			objectives: this._missionObjectives,
			hostiles: this._hostiles,
			player: this._player,
			joystick: this._joystick,
			keyboard: this.keyboard
		});

		R.times(() => { this.spawnGerm(); }, this._missionObjectives.hostiles.initial);

    this.setSpriteLayersPosition()
  }

  setMissionObjectives() {
		// Set mission targets
		// TODO: this needs to be extended and randomly generated ot create levels
    console.log('create mission!');
		const maxHostiles = this.game.rnd.integerInRange(15, 20);
		this._missionObjectives = {
			time: this.game.rnd.integerInRange(4, 9) * 10000,
			kills: this.game.rnd.integerInRange(10, maxHostiles),
			hostiles: {
				initial: this.game.rnd.integerInRange(1, 10),
				max: maxHostiles,
				spawnRate: 2 / 1
			},
			grid: DEFAULT_GRID
		};

		// this._missionObjectives.hostiles.initial = 0;
		// this._missionObjectives.hostiles.max = 1;
  }

  resetMission() {
    // Reset global values
		this.game._global.missionComplete = false;
		this.game._global.score = 0;
		this.game._global.missionCount += 1;
  }

  initUserInputControls() {
		// Touch controls
		this._gamepad = this.game.plugins.add(Phaser.Plugin.VirtualGamepad);
		this._joystick = this._gamepad.addJoystick(GAMEPAD.PADDING, CANVAS.HEIGHT - GAMEPAD.PADDING, 1.2, 'gamepad');
		this._fireButton = this._gamepad.addButton(CANVAS.WIDTH - 75, CANVAS.HEIGHT - 70, 1, 'gamepad');

		// Keyboard controls
		this.keyboard = {
			cursorUp: this.game.input.keyboard.addKey(Phaser.Keyboard.UP),
			cursorDown: this.game.input.keyboard.addKey(Phaser.Keyboard.DOWN),
			cursorLeft: this.game.input.keyboard.addKey(Phaser.Keyboard.LEFT),
			cursorRight: this.game.input.keyboard.addKey(Phaser.Keyboard.RIGHT),
			spaceBar: this.game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR)
		}
  }

  initBackground() {
		// Add background tiles
		this.game.stage.backgroundColor = '#6f0100';
		// this.game.add.tileSprite(0, 0, this.game.world.width, this.game.world.height, 'bg');
		this.game.add.tileSprite(0, 0, this.game.world.width, this.game.world.height, 'grid');
		this._parallax = [
			new ParallaxTile(this.game, 'parallax_far', 0.05),
			new ParallaxTile(this.game, 'parallax_mid', 0.15),
			// new ParallaxTile(this.game, 'parallax_near', 0.5),
			new ParallaxTile(this.game, 'parallax_near', 1.5)
		];
  }

  setSpriteLayersPosition() {

		// Bring last parallax bg in front of player
		R.last(this._parallax).tileSprite.bringToTop();
    this.game.world.bringToTop(this._mission.immovables.spriteGroup);

		// this._cockpit
		// this._debugText

		this._joystick.bringToTop();
		this._joystick._padSprite.bringToTop();
    this._fireButton.bringToTop();
  }

	spawnGerm() {
		const { x, y } = getRandomCoords(this._world.width, this._world.height);
		this._hostiles.spawn(x, y);
	}

	// TODO: PLayer.js
	emitBloodSplatterParticles(x, y) {
		this.__emitterBloodSplatter.x = x;
		this.__emitterBloodSplatter.y = y;
		this.__emitterBloodSplatter.flow(200, 25, 1, 3);
	}

	onLaserHitGerm(laser, germ) {
		this.emitBloodSplatterParticles(germ.body.center.x, germ.body.center.y);
		laser.kill();
		this.killGerm(germ);
	}

	onPlayerGermImpact(player, germ) {
		this.emitBloodSplatterParticles(germ.body.center.x, germ.body.center.y);
		this._player.updateHealth(-0.3);
		this.addScore(-10);
	}

	onActorImmovableImpact(actor, immovable) {
		// Needs a callback for collision detection - do nothing
	}

	onLaserImmovableImpact(laser, immovable) {
		this.emitBloodSplatterParticles(laser.body.center.x, laser.body.center.y);
		laser.kill();
	}

	// TODO: Belong in Hostile.js
	killGerm(germ) {
		// Animate death of germ
		const killTweenDuration = 200;
		const killTween = this.game.add.tween(germ.scale);
		killTween.to({ x: 0, y: 0 }, killTweenDuration, Phaser.Easing.Linear.None);
		killTween.onComplete.addOnce(() => {
			// germ.kill();
			germ.destroy();
		});
		killTween.start();
		this.addScore(20);
	}

	update() {
		const delta = this.game.time.physicsElapsed;
		const timeLeft = this.__timerEvent.delay - this.__timer.ms;

		this._player.updatePlayer(delta);

		if (this.keyboard.spaceBar.isDown || this._fireButton.isDown) {
			this.fireLaser();
		}

		// Collision detection
		this.game.physics.arcade.overlap(this.lasers, this._hostiles.spriteGroup, this.onLaserHitGerm.bind(this));
		this.game.physics.arcade.collide(this._player.sprite, this._hostiles.spriteGroup, this.onPlayerGermImpact.bind(this));
		this.game.physics.arcade.collide(this._player.sprite, this._mission.immovables.spriteGroup, this.onActorImmovableImpact.bind(this));
		this.game.physics.arcade.overlap(this.lasers, this._mission.immovables.spriteGroup, this.onLaserImmovableImpact.bind(this));
		this.game.physics.arcade.collide(this._hostiles.spriteGroup, this._mission.immovables.spriteGroup, this.onActorImmovableImpact.bind(this));

		// update debug info
		this._debugText.update(timeLeft);

		// update the cockpit dashboard
		this._cockpit.update(timeLeft);

		const germSpawnFrequencyPerSecond = this._missionObjectives.hostiles.spawnRate;
		doPerSecondProbably(() => { this.spawnGerm(); }, delta, germSpawnFrequencyPerSecond);

    this._mission.check();

		this._parallax.forEach((parallax, index) => {
			parallax.update(this._player.sprite.x, this._player.sprite.y);
		});
	}

	addScore(increase) {
		this.game._global.score += increase;
	}

	// TODO: Should belong in Player.js
	fireLaser() {
		if (this._player.energy < ENERGY_COST.LASER ||
			this.game.time.now <= this.laserTime) {
			return;
		}

		this._player.fireLaser();

		this.laser = this.lasers.getFirstExists(false);

		if (this.laser) {
			this.laser.reset(
				this._player.sprite.centerX,
				this._player.sprite.centerY
			);
			this.laser.lifespan = 2000;
			this.laser.angle = this._player.sprite.angle;
			this.game.physics.arcade.velocityFromRotation(
				this._player.sprite.rotation,
				1000,
				this.laser.body.velocity
			);
			this.laserTime = this.game.time.now + 100;
			this._player.updateEnergy(-ENERGY_COST.LASER);
		}
	}

}

export default Main;
