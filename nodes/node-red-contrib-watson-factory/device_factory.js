module.exports = function(RED) {
    "use strict";
    var IBMIoTF = require('ibmiotf');
    var cfEnv = require("cfenv");

    var appClient;
    
    //support for multiple orgs
    
    var wiot_services  = cfEnv.getAppEnv().services['iotf-service'][0];
    console.log(wiot_services);

    if (wiot_services) {
      var appClientConfig = {
        org: wiot_services.credentials.org,
        id: Date.now().toString(),
        "auth-key": wiot_services.credentials.apiKey,
        "auth-token": wiot_services.credentials.apiToken
        };
      appClient = new IBMIoTF.IotfApplication(appClientConfig);

    }

    RED.httpAdmin.get('/devicefactory/vcap', function(req,res) {
        res.send(JSON.stringify(wiot_services));
    });

    RED.httpAdmin.get('/devicefactory/gettypes', function(req,res) {

        appClient.getAllDeviceTypes().then (function onSuccess (response) {
              res.send(response);
        }, function onError (error) {
                res.status(403).send("No device types");
        });
    });

    function DeviceFactoryHandler(config) {
        RED.nodes.createNode(this,config);

        var node = this;

        this.on('input', function(msg) {

          // Functions for success and failure for rest calls. 
          var clearStatus = function(){
            setTimeout( function(){
              node.status({});
            },2000);
          }

          var onSuccess = function(argument) {
                  var msg = {
                    payload : argument
                  }
                  node.send(msg);
                  node.status({fill:"green",shape:"dot",text:"Sucess"});
                  clearStatus();
          };

          var onError =  function(argument) {
                  var msg = {
                    payload : argument
                  }
                  node.send(msg);

                  node.status({fill:"red",shape:"dot",text:"Error"});
          };


          node.status({fill:"blue",shape:"dot",text:"Requesting"});

          //pass the operation name in msg
          var operation = msg.method ? msg.method : config.method;

          //rest all values from msg.payload
          //try to parse the payload if its string
          if( typeof msg.payload === 'string') {
            try {
              msg.payload = JSON.parse(msg.payload);
            } catch( exception) {
              node.error("msg.payload must be a JSON or a JSON string");
              clearStatus();
              return;
            }
          }

          // take the values from config, if not get it from msg.
          var deviceType = config.deviceType ? config.deviceType : msg.payload.deviceType;
          var deviceId = config.deviceId ? config.deviceId : msg.payload.deviceId;


          // get the values from msg.
          var authToken = msg.payload.authToken ? msg.payload.authToken : undefined;
          var desc = msg.payload.description ? msg.payload.description :  "";
          var metadata = msg.payload.metadata ? msg.payload.metadata : {};
          var deviceInfo = msg.payload.deviceInfo ? msg.payload.deviceInfo : {};
          var location = msg.payload.location ? msg.payload.location : {};
          var extensions = msg.payload.extensions ? msg.payload.extensions : {};
          var status = msg.payload.status ? msg.payload.status : {};

          
          if(!deviceType ){
            node.error("DeviceType must be set for "+operation+" operation. You can either set in the configuration or must be passed as msg.payload.deviceType");
            clearStatus();
            return;
          }

          if((operation !== 'GetAll' ) && !deviceId ){
            node.error("DeviceId must be set for "+operation+" operation. You can either set in the configuration or must be passed as msg.payload.deviceId");
            clearStatus();
            return;
          }

          switch (operation) {
                case "Create":
                  appClient.registerDevice(deviceType, deviceId, authToken, deviceInfo, location, metadata).then(onSuccess,onError);
                  break;
                case "Update":
                  appClient.updateDevice(deviceType, deviceId, deviceInfo, status, metadata, extensions).then(onSuccess,onError);
                  break;
                case "Delete":
                  appClient.unregisterDevice(deviceType, deviceId).then(onSuccess,onError);
                  break;
                case "Get":
                  appClient.getDevice(deviceType, deviceId).then(onSuccess,onError);
                  break;
                case "GetAll":
                  appClient.listAllDevicesOfType(deviceType).then(onSuccess,onError);
                  break;
                case "GetLoc":
                  appClient.getDeviceLocation(deviceType, deviceId).then(onSuccess,onError);
                  break;
                case "UpdateLoc":
                  if(!location) {
                    node.error("Location must be set. It can be set using msg.location");
                    return;
                  }
                  appClient.updateDeviceLocation(deviceType, deviceId, location).then(onSuccess,onError);
                  break;
                case "GetDm":
                  appClient.getDeviceManagementInformation(deviceType, deviceId).then(onSuccess,onError);
                  break;
                case "Get all gw":
                //appClient.listAllDevicesOfType(type).then(onSuccess,onError);
                  break;
          }
            //msg.payload = msg.payload.toLowerCase();
            // node.send(msg);
        });
    }
    RED.nodes.registerType("device-factory",DeviceFactoryHandler);

    function WIoTPNode(n) {
      RED.nodes.createNode(this,n);
      this.name = n.name;

      if (this.credentials) {
        this.username = this.credentials.user;
        this.password = this.credentials.password;
      }
    }

    RED.nodes.registerType("wiotp",WIoTPNode, {
      credentials: {
        user: {type:"text"},
        password: {type:"password"}
      }
    });
}
