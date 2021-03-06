import Phaser, { Game, GameObjects, Sound } from "phaser";
import StateMachine from "./state_machine";
import ObstaclesController from "./obstacles_controller";

import { eventEmitter as events } from "./eventcenter";
import { MouseConstraint } from "matter";


type CursorKeys = Phaser.Types.Input.Keyboard.CursorKeys;

export default class playerController {
  private scene: Phaser.Scene;
  private sprite: Phaser.Physics.Matter.Sprite;
  private cursors: CursorKeys;
  private obstacles: ObstaclesController;

  private stateMachine: StateMachine;
  private canDoubleJump: boolean = true;

  private health: number = 1;
  private jumpSpeed: number = 5;
  private walkSpeed: number = 3;

  /*
  THE FOLLOWING BLOCK SETS UP PABLO WITH THE SCENE 
*/
  constructor(
    scene: Phaser.Scene,
    sprite: Phaser.Physics.Matter.Sprite,
    cursors: CursorKeys,
    obstacles: ObstaclesController
  ) {
    this.scene = scene;
    this.sprite = sprite;
    this.cursors = cursors;
    this.obstacles = obstacles;

    this.createAnimations();

    this.stateMachine = new StateMachine(this, "player");

    this.stateMachine
      .addState("idle", {
        onEnter: this.idleOnEnter,
        onUpdate: this.idleOnUpdate,
      })
      .addState("walk", {
        onEnter: this.walkOnEnter,
        onUpdate: this.walkOnUpdate,
      })
      .addState("jump", {
        onEnter: this.jumpOnEnter,
        onUpdate: this.jumpOnUpdate,
      })
      .addState("double_jump", {
        onEnter: this.doubleJumpOnEnter,
        onUpdate: this.doubleJumpOnUpdate,
      })
      .addState("hit", {
        onEnter: this.hitOnEnter,
      })
      .addState("dead", {
        onEnter: this.deadOnEnter,
      })
      .addState("bounce", {
        onEnter: this.bounceOnEnter,
        onUpdate: this.bounceOnUpdate,
      })
      .setState("idle");
    /*
  HANDLES INTERACTION WITH THE MAP 
*/
    this.sprite.setOnCollide((data: MatterJS.ICollisionPair) => {
      const body = data.bodyB as MatterJS.BodyType;
      if (this.obstacles.is("spikes", body)) {
        this.stateMachine.setState("hit");
        //this.health - 1;
        return;
      } else if (this.obstacles.is("bounce", body)) {
        console.log("bounce");
        this.stateMachine.setState("bounce");
        return;
      }
      const gameObject = body.gameObject;
      if (!gameObject) {
        return;
      }

      if (gameObject instanceof Phaser.Physics.Matter.TileBody) {
        if (this.stateMachine.isCurrentState("jump")) {
          this.stateMachine.setState("idle");
        } else if (this.stateMachine.isCurrentState("double_jump")) {
          this.stateMachine.setState("idle");
        } else if (this.stateMachine.isCurrentState("bounce")) {
          this.stateMachine.setState("idle");
        } 
        return;
      }

      const sprite = gameObject as Phaser.Physics.Matter.Sprite;
      const type = sprite.getData("type");
      /*
  THIS SWITCH HANDLES ITEM PICKUPS 
*/
      switch (type) {
        case "strawberry": {
          events.emit("strawberry_collected");
          sprite.play("collected");
          sprite.on("animationcomplete", sprite.destroy);
          break;
        }

        case "pineapple": {
          events.emit("pineapple_collected", this.health);
          if(this.health == 0){
            this.setHealth(this.health+1);
          }
          sprite.play("collected");
          sprite.on("animationcomplete", sprite.destroy);
        }
      }
    });
  }
  update(dt: number) {
    this.stateMachine.update(dt);
  }
  /*
  IDLE STATE 
*/
  private idleOnEnter() {
    if(this.stateMachine.previousStateName == "dead"){
      return;
    }
    this.scene.sound.stopByKey("footsteps");
    this.sprite.play("pablo_idle");
  }
  private idleOnUpdate() {
    if(this.stateMachine.previousStateName == "dead"){
      return;
    }
    if (this.cursors.left.isDown || this.cursors.right.isDown) {
      this.stateMachine.setState("walk");
    }
    const spaceJustPressed = Phaser.Input.Keyboard.JustDown(this.cursors.space);
    if (spaceJustPressed) {
      this.stateMachine.setState("jump");
    }
  }

  /*
  WAlK STATE 
*/
  private walkOnEnter() {
    this.sprite.play("pablo_run");
    
    this.scene.sound.play("footsteps");
  }

  private walkOnUpdate() {
    if (this.cursors.left.isDown) {
      this.sprite.flipX = true;
      this.sprite.setVelocityX(-this.walkSpeed);
    } else if (this.cursors.right.isDown) {
      this.sprite.flipX = false;
      this.sprite.setVelocityX(this.walkSpeed);
    } else {
      this.sprite.setVelocityX(0);
      this.stateMachine.setState("idle");
    }
    const spaceJustPressed = Phaser.Input.Keyboard.JustDown(this.cursors.space);
    if (spaceJustPressed) {
      this.stateMachine.setState("jump");
    }
  }

  /*
  JUMPING STATE 
*/
  private jumpOnEnter() {
    this.sprite.setVelocityY(-this.jumpSpeed);
    this.sprite.play("pablo_jump");
    this.canDoubleJump = true;
  }

  private jumpOnUpdate() {
    const spaceJustPressed = Phaser.Input.Keyboard.JustDown(this.cursors.space);

    if (this.cursors.left.isDown) {
      this.sprite.flipX = true;
      this.sprite.setVelocityX(-this.jumpSpeed);
    } else if (this.cursors.right.isDown) {
      this.sprite.flipX = false;
      this.sprite.setVelocityX(this.jumpSpeed);
    } else if (this.sprite.body.velocity.y > 0) {
      this.sprite.play("pablo_fall");
    }

    if (spaceJustPressed && this.canDoubleJump) {
      this.stateMachine.setState("double_jump");
      this.canDoubleJump = false;
    }
  }

  private doubleJumpOnEnter() {
    this.sprite.setVelocityY(-4);
    this.sprite.play("pablo_double_jump", true);
  }

  private doubleJumpOnUpdate() {
    const speed = 5;

    if (this.cursors.left.isDown) {
      this.sprite.flipX = true;
      this.sprite.setVelocityX(-speed);
    } else if (this.cursors.right.isDown) {
      this.sprite.flipX = false;
      this.sprite.setVelocityX(speed);
    } else if (this.sprite.body.velocity.y > 0) {
      this.sprite.play("pablo_fall", true);
    }
  }
  /*
  HIT STATE 
*/
  private hitOnEnter() {
    this.sprite.setVelocityY(-5);

    const startColor = Phaser.Display.Color.ValueToColor(0xffffff);
    const endColor = Phaser.Display.Color.ValueToColor(0xff0000);

    this.scene.tweens.addCounter({
      from: 0,
      to: 100,
      duration: 100,
      repeat: 2,
      yoyo: true,
      ease: Phaser.Math.Easing.Sine.InOut,
      onUpdate: (tween) => {
        const value = tween.getValue();
        const colorObject = Phaser.Display.Color.Interpolate.ColorWithColor(
          startColor,
          endColor,
          100,
          value
        );
        const color = Phaser.Display.Color.GetColor(
          colorObject.r,
          colorObject.g,
          colorObject.b
        );

        this.sprite.setTint(color);
      },
    });

    this.setHealth(this.health - 1);
    events.emit("hit", this.health);
    this.stateMachine.setState("idle");
  }
  /*
  HEALTH & DEATH
*/
  private deadOnEnter(){     
    this.sprite.setOnCollide(() => {})
    this.sprite.play('pablo_dead', true);
    this.scene.cameras.main.fadeOut(1000, 0, 0, 0)
    events.emit("death")

    this.scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, (cam, effect)=>{
      this.scene.scene.stop('UI');
      this.scene.scene.stop('level_1');
      this.scene.scene.start('death');
    })
  }
  private setHealth(value: number) {
    this.health = Phaser.Math.Clamp(value, -1, 1);
    events.emit("health-changed", this.health);
    console.log(this.health);
    if (this.health <= -1) {
      this.stateMachine.setState("dead");
    }
  }
  /*
  BOUNCE STATE 
*/
  private bounceOnEnter() {
    this.sprite.setVelocityY(-this.jumpSpeed), this.sprite.play("pablo_jump");
  }

  private bounceOnUpdate() {
    if (this.cursors.left.isDown) {
      this.sprite.flipX = true;
      this.sprite.setVelocityX(-this.walkSpeed);
    } else if (this.cursors.right.isDown) {
      this.sprite.flipX = false;
      this.sprite.setVelocityX(this.walkSpeed);
    } else if (this.sprite.body.velocity.y > 0) {
      this.sprite.play("pablo_fall");
    }
  }

  /*
  LOAD ANIMATIONS 
*/
  private createAnimations() {
    this.sprite.anims.create({
      key: "pablo_idle",
      frameRate: 20,
      frames: this.sprite.anims.generateFrameNames("pablo_idle", {
        start: 0,
        end: 10,
        prefix: "Idle (32x32)-",
        suffix: ".png",
      }),
      repeat: -1,
    });
    this.sprite.anims.create({
      key: "pablo_run",
      frameRate: 20,
      frames: this.sprite.anims.generateFrameNames("pablo_run", {
        start: 0,
        end: 11,
        prefix: "Run (32x32)-",
        suffix: ".png",
      }),
      repeat: -1,
    });
    this.sprite.anims.create({
      key: "pablo_double_jump",
      frameRate: 20,
      frames: this.sprite.anims.generateFrameNames("pablo_double_jump", {
        start: 0,
        end: 5,
        prefix: "Double Jump (32x32)-",
        suffix: ".png",
      }),
      repeat: -1,
    });
    this.sprite.anims.create({
      key: "pablo_hit",
      frameRate: 20,
      frames: this.sprite.anims.generateFrameNames("pablo_hit", {
        start: 0,
        end: 6,
        prefix: "Hit (32x32)-",
        suffix: ".png",
      }),
      repeat: -1,
    });
    this.sprite.anims.create({
      key: "pablo_jump",
      frameRate: 20,
      frames: "pablo_jump",
      repeat: -1,
    });
    this.sprite.anims.create({
      key: "pablo_fall",
      frames: "pablo_fall",
      repeat: -1,
    });
    this.sprite.anims.create({
      key: "pablo_dead",
      frames: "pablo_dead",
      repeat: -1,
    });
  }
}
