/*
Copyright (c) Lightstreamer Srl

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
define(["./Constants","./Utils"],function(Constants,Utils) {
  
  var tmpGeometry = new THREE.CubeGeometry(2,4,2);
  var tmpMaterial = new THREE.MeshLambertMaterial( { color: 0xdddddd } );
  
  var materials = {};
  materials[Constants.OWN] = new THREE.MeshBasicMaterial( { color: 0xff0000 } );
  materials[Constants.OTHER] = new THREE.MeshBasicMaterial( { color: 0x006b00 } );
  
  var mtls = {};
  mtls[Constants.OWN] = "obj/dart.obj.mtl";
  mtls[Constants.OTHER] = "obj/dartb.obj.mtl";
  
  
  var waiting = {};
  waiting[Constants.OWN] = [];
  waiting[Constants.OTHER] = [];
  var clonable = {};
  function loadClonable(type) {
    Utils.loadObj("obj/dart.obj", mtls[type], function (object) {
      clonable[type] = object;
      for(var i=0; i<waiting[type].length; i++) {
        waiting[type][i].convertDart();
      }
      waiting[type] = null;
    });
  }
  loadClonable(Constants.OWN);
  loadClonable(Constants.OTHER);
  
  var NICK_OFFSET = {
      x: function(size) {
        return -size/2;
      },
      y: -30,
      z: 30
  };
  var FONT_SIZE = 12;
  
  //assumes  NICK_OFFSET.y is < 0
  var SWITCH_NICK_POSITION = -(Constants.MAX_SIZE.y + NICK_OFFSET.y - FONT_SIZE);
  
  var CAMERA_OFFSET = {
      x: 0,
      y: 0,
      z: 250
  };
  
  var MAX_CAMERA_POS = {
      x: 10,
      y: 10
  };
  
  var hitSound = Utils.loadSound("hit"); // https://www.youtube.com/watch?v=Zt_L-J6xcN0
  var throwSound = Utils.loadSound("throw"); // http://soundbible.com/963-Arrow.html
  
  
  //Dart obj is 13.598 units, we want it 96
  var expectedSize = Constants.DART_ORIGINAL_SIZE;
  var SCALE_TO = expectedSize/13.598;
  
  var Dart = function(key,type,field,showInfo,audio) {
    this.field = field;
    
    this.dart = null;
    this.dinamics =  new THREE.Vector3( 0, 0, 0 );
    this.startPos =  new THREE.Vector3( 0, 0, 0 );
    
    this.status = "";
    
    this.text = null; 
    this.nick = null;
    this.showNickFlag = showInfo;
    this.audio = audio;
    
    this.timestamp = 0;
    
    this.key = key;
    this.type = type;
    
    this.planted = false;
    this.plantedTime = null;
    
    this.initDart();
  };
  
  
  Dart.prototype = {
      /**
       * @private
       */
      initDart: function() {
        if (!clonable[this.type]) {
          //wait
          this.dart = new THREE.Mesh(tmpGeometry,tmpMaterial);
          this.dart.castShadow = true;
          waiting[this.type].push(this);
        } else {
          this.createDart();
        }
        
        this.reset();
    
        this.field.addObject(this.dart);
      },
      
      /**
       * @private
       */
      createDart: function() {
        this.dart = clonable[this.type].clone();
        this.dart.scale.set(SCALE_TO,SCALE_TO,SCALE_TO);
      },
      
      /**
       * @private
       */
      convertDart: function() {
        var tmp = this.dart;
        this.createDart();
        
        //text already correctly positioned
        this.dart.position = tmp.position;
        this.dart.quaternion = tmp.quaternion;
        
        this.field.removeObject(tmp);
        this.field.addObject(this.dart);
      },
      
      changeType: function(newType) {
        if (newType == this.type) {
          return;
        }
        this.type = newType;

        this.convertDart();
        
        if (this.text) {
          this.text.material = materials[this.type];
        }
      },
      
      clear: function() {
        this.field.removeObject(this.dart);
        this.dart = null;
        this.showNick(false);
      },
        
      setNick: function(nick) {
        this.nick = nick;
        this.showNick(this.showNickFlag);
      },
      
      setStatus: function(status) {
        this.status = status;
      },
      
      enableAudio: function(enable) {
        this.audio = enable;
      },
      
      /**
       * @private
       */
      showNick: function(show) {
        if (this.text != null) {
          this.field.removeObject(this.text);
          this.text = null;
        }
        
        this.showNickFlag = show;
        
        if (this.nick == null || this.nick == "" || !show) {
          return;
        }
        
        var text3d = new THREE.TextGeometry( this.nick, {
              size: FONT_SIZE,
              height: 0,
              curveSegments: 0,
              
              font: "droid sans",
              weight: "bold"
            });
        text3d.computeBoundingBox();

        this.text = new THREE.Mesh(text3d, materials[this.type]);
        
        this.nickOffsetX = NICK_OFFSET["x"](text3d.boundingBox.max.x);
        
        this.text.position.x = this.dart.position.x+this.nickOffsetX;
        this.text.position.y = this.dart.position.y+NICK_OFFSET["y"];
        this.text.position.z = this.dart.position.z+NICK_OFFSET["z"];
        this.field.addObject(this.text);
      }, 
      
      getKey: function() {
        return this.key;
      },
      getDart: function() {
        return this.dart;
      },
      getDinamics: function() {
        return this.dinamics;
      },
      getNick: function() {
        return this.nick;
      },
      getStatus: function() {
        return this.status;
      },
      isFlying: function() {
        return this.dinamics.z != 0;
      },
      isPlanted: function() {
        return this.planted;
      },
      getPlantedDelta: function() {
        if (this.plantedTime) {
          return new Date().getTime() - this.plantedTime;
        }
        return 0;
      },
      
      attachCamera: function(attach) {
        this.camera = attach;
        this.field.enableOrbit(!attach);
        this.field.hideMenu(attach);
      },
      
      //Rotation
      
      setRotation: function(x,y,z) {
        this.setRot("x",x);
        this.setRot("y",y);
        this.setRot("z",z);
      },
      
      setRot: function(axis,val) {
        this.dart.rotation[axis] = val;
      },
      
      //speed
      
      setSpeed: function(vx,vy,vz) {
        this.dinamics.x = vx;
        this.dinamics.y = vy;
        
        var currZ = this.dinamics.z;
        this.dinamics.z = vz;
        
        if (vz !== 0) {
          this.doSound(throwSound);
          
          this.timestamp = new Date().getTime();
          this.fixStartPosition();
          this.calculate();
         
        } else if (currZ != 0) {
          this.doSound(hitSound);
        }
      },
      
      //Sound
      
      doSound: function(sound) {
        if (sound && this.audio) {
          sound.play();
        }
      },
      
      
      
      //Position
      
      /**
       * @private
       */
      fixStartPosition: function(x,y,z) {
        this.startPos.x = this.dart.position.x;
        this.startPos.y = this.dart.position.y;
        this.startPos.z = this.dart.position.z;
      },
      
      setPosition: function(x,y,z) {
        this.setPos("x",x);
        this.setPos("y",y);
        this.setPos("z",z);
        
        if (this.camera && this.isFlying()) {
          this.repositionCamera();
        }
      },
      
      repositionCamera: function() {
        var x = this.dart.position.x;
        var y = this.dart.position.y;
        var z = this.dart.position.z;
        
        var px = x+CAMERA_OFFSET.x;
        var py = y+CAMERA_OFFSET.y;
        var pz = z+CAMERA_OFFSET.z;
        
        if (px > MAX_CAMERA_POS["x"]) {
          px = MAX_CAMERA_POS["x"];
        } else if (px < -MAX_CAMERA_POS["x"]) {
          px = -MAX_CAMERA_POS["x"];
        }
        if (py > MAX_CAMERA_POS["y"]) {
          py = MAX_CAMERA_POS["y"];
        } else if (py < -MAX_CAMERA_POS["y"]) {
          py = -MAX_CAMERA_POS["y"];
        }
        
        this.field.moveCameraToward(px,py,pz);
        this.field.pointCamera(x,y,z);
      },
      
      /**
       * @private
       */
      setPos: function(axis,value) {
        if (value ==  this.dart.position[axis]) {
          return;
        }
        
        this.dart.position[axis] = value;
        if (this.text) {
          if (axis == "x") {
            this.text.position[axis] = value+this.nickOffsetX;
          } else if (axis == "y" && value < SWITCH_NICK_POSITION){
            this.text.position[axis] = value-NICK_OFFSET[axis];
          } else {
            this.text.position[axis] = value+NICK_OFFSET[axis];
          }
        }
        
        this.field.render();
      },
      
      //calculus
      
      /**
       * @private
       */
      getFinalTimeIfOverflow: function(axis,value) {
        
        if (value > Constants.MAX_SIZE[axis] || value < -Constants.MAX_SIZE[axis]) {
          var endValue =  value > Constants.MAX_SIZE[axis] ? Constants.MAX_SIZE[axis] : -Constants.MAX_SIZE[axis]; 
          
          if (axis == "y") {
            return this.calculateTimestampY(endValue);
          } else {
            return this.calculateTimestamp(axis,endValue);
          }
        }
        
        return null;
      },
      
      /**
       * @private
       */
      calculateTimestamp: function(axis,value) {
        return Math.abs((value-this.startPos[axis])/this.dinamics[axis]);
      },
      
      /**
       * @private
       */
      calculateAxisPos: function(axis,tNow) {
        return this.startPos[axis] + this.dinamics[axis]*tNow;
      },
      
      /**
       * @private
       */
      calculateYPosition: function(tNow) {
        //s = v*t + (1/2)at^2
        var units = Constants.HALF_ACCELERATION*Math.pow(tNow,2);
        return this.calculateAxisPos("y",tNow) - units;
      },
      
      /**
       * @private
       */
      calculateTimestampY: function(value) {
        
        //s =  v*t + (1/2)at^2
        
        var c = -(value-this.startPos["y"]);
        var a = -Constants.HALF_ACCELERATION;
        var b = this.dinamics["y"];
        
        var d = Math.pow(b,2) - 4*a*c;
        
        if (c<0) {
          return (-b + Math.sqrt(d))/(2*a);
        } else if(c>0) {
          return (-b - Math.sqrt(d))/(2*a);
        }
        return 0;
        
      },
      
      
      calculate: function() { 
        if (!this.isFlying()) {
          return;
        }
        
        var tNow = new Date().getTime() - this.timestamp;
        
        var x = this.calculateAxisPos("x",tNow);
        var y = this.calculateYPosition(tNow);
        var z = this.calculateAxisPos("z",tNow);
       
        var isLanded = this.calculateLanding(x,y,z);
        if (!isLanded) {
          this.setPosition(x,y,z);
          this.calculateRotation(x,y,z,tNow);
        } else if(this.camera) {
          this.field.enableOrbit(true);
          this.field.hideMenu(false);
        }
        
      },
      
      calculateRotation: function(x,y,z,tNow) {
        var currentSpeedY = this.dinamics.y + -Constants.ACCELERATION*tNow;
        
        var x = this.getRotationRadians(currentSpeedY,this.dinamics.z) + Math.PI/2;
        var y = this.getRotationRadians(this.dinamics.x,this.dinamics.z);
        
        this.setRotation(x,0,y);
      },
     
      
      getRotationRadians: function(v1,v2) {
        var up = v1 >= 0;
        var v1IsBigger = Math.abs(v1) > Math.abs(v2);
        var rot = Math.atan(v1IsBigger ? v1/v2 : v2/v1);
        
        if (v1IsBigger) {
          return -rot;
        } else if (up) {
          return rot + Math.PI/2;
        } else {
          return rot - Math.PI/2;
        }

      },
      
      calculateLanding: function(x,y,z) {
        var endXt = this.getFinalTimeIfOverflow("x",x);
        var endYt = this.getFinalTimeIfOverflow("y",y);
        var endZt = this.getFinalTimeIfOverflow("z",z);
        
        if (endXt !== null || endYt !== null ||  endZt !== null) {
          var tEnd = endXt;
          tEnd = tEnd === null || endYt !== null && endYt < tEnd ? endYt : tEnd;
          tEnd = tEnd === null || endZt !== null && endZt < tEnd ? endZt : tEnd;
          x = this.calculateAxisPos("x",tEnd);
          y = this.calculateYPosition(tEnd);
          z = this.calculateAxisPos("z",tEnd);
          
          this.setPosition(x,y,z);
          this.calculateRotation(x,y,z,tEnd);
          this.setSpeed(0,0,0);
          
          /*
          console.log("Start "+this.startPos.x+"|"+this.startPos.y+"|"+this.startPos.z);
          console.log("Speed "+this.dinamics.x+"|"+this.dinamics.y+"|"+this.dinamics.z);
          console.log(tEnd);
          console.log("End "+x+"|"+y+"|"+z);
          */
          
          this.planted = true;
          this.plantedTime = new Date().getTime();
          
          return true;
        }
        return false;
      },
      
      reset: function() {
        var randX = Math.round(Math.random()*Constants.ARM_LENGTH)-Constants.ARM_LENGTH/2;
        var randY = Math.round(Math.random()*Constants.ARM_LENGTH)+Constants.TWENTY-Constants.ARM_LENGTH/2;
        
        this.setPosition(randX,randY,Constants.MAX_SIZE.z);
        this.setRotation(Math.PI/2,0,0);
        this.planted = false;
        this.plantedTime = null;
        if (this.camera) {
          this.attachCamera(false);
          this.field.resetCamera();
        }
        
      } 
  };
  
  return Dart;
});