const db = require("../models");
// TODO - start
// TODO - later, consider to refactor the below dependencies passing through from server.js
// const path = app.get('path');
// const uuid = app.get('uuid');
// const fs = app.get('fs');
// const VisualRecognitionV3 = app.get('watson');
// TODO - and, remove the corresponding ones below
const path = require('path');
const uuid = require('uuid');
const fs = require("fs");
const VisualRecognitionV3 = require("watson-developer-cloud/visual-recognition/v3");
var Quagga = require('quagga').default;
const nutritionixController = require("./nutritionixController");
const Promise = require("bluebird");


// TODO - end
require("dotenv").config({
  silent: true
});
const visual_recognition = new VisualRecognitionV3({
  version: "2018-03-19"
});


// Defining methods for the foodController
module.exports = {
  parseBase64Image: function (imageString) {
    var matches = imageString.match(/^data:image\/([A-Za-z-+/]+);base64,(.+)$/);
    var resource = {};

    if (matches.length !== 3) {
      return null;
    }

    resource.type = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    resource.data = new Buffer(matches[2], 'base64');
    return resource;
  },
  // we will use identifyFood to call to watson
  identifyFood: async function (req, res) {

    console.log(`===> hit the /api/food "watson" route`);

    const params = {
      classifier_ids: ["food"],
      image_file: null
    };
    console.log("about to parse from Watson: ")
    // let resource = parseBase64Image(req.body.image)

    // TODO - begin - refactor later to separate function
    let imageString = req.body.image
    // console.log(`===> the image is: ${imageString}`)

    let matches = imageString.match(/^data:image\/([A-Za-z-+/]+);base64,(.+)$/);
    let resource = {};
    if (matches.length !== 3) {
      res.send({ data: "ERROR: Bad Image" });
      return null;
    }
    resource.type = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    resource.data = new Buffer(matches[2], 'base64');
    // TODO - end - refactor later to separate function

    let temp = path.join(__dirname + "/pics", uuid.v1() + '.' + resource.type);
    console.log("========> temp file is: " + temp)
    fs.writeFileSync(temp, resource.data, { mode: '664' });

    params.image_file = fs.createReadStream(temp);


    // Promisify the call to watson
    visual_recognition.classify = Promise.promisify(visual_recognition.classify);
    // nutritionixController.nutritionixInstantSearchDirect = Promise.promisify(nutritionixController.nutritionixInstantSearchDirect)

    console.log("====> about to call watson!");
    visual_recognition.classify(params)
      .then(response => {
        // no longer need the image file so remove it!
        fs.unlink(temp, (err) => {
          if (err) console.log(`ERROR:  could not remove file: ${temp}`)
        })
        const labelsvr = response.images[0].classifiers[0].classes[0].class;
        // console.log("===> got this from watson: " + JSON.stringify(labelsvr));
        if (labelsvr === "non-food") {
          console.log(`going to respond back to the front end that the item could not be identified`)
          res.send({ code: "ERR-100: Could not identify item!" })
          throw new Error('abort promise chain after call to Watson: non-food');
          return null
        } else {
          console.log(`now going to call nutrionix with the data.....`);
          // res.send({ data: nutritionixController.nutritionixInstantSearchDirect(labelsvr) })
          return response.images[0].classifiers[0].classes[0].class
        }
      })
      .then(response => {
        console.log(`....going to call nutritionix now....`)
        nutritionixController.nutritionixInstantSearchDirect(response)
          .then(nutritionresponse => {
            // console.log(`==> got this back from nutritiionix and going back to the front: ${nutritionresponse}`)
            res.send({ code: "000", data: nutritionresponse })
          })
      })
      .catch(error => {
        console.log(`watson error is: ${error}`)
      })
  },
  scanBarcode: function (req, res) {
    console.log(`===> hit the /api/food/scanner "scanBarcode" route`);
    let imageString = req.body.image
    // console.log(`===> the image is: ${imageString}`)

    let matches = imageString.match(/^data:image\/([A-Za-z-+/]+);base64,(.+)$/);
    let resource = {};
    if (matches.length !== 3) {
      res.send({ data: "ERROR: Bad Image" });
      return null;
    }
    resource.type = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    resource.data = new Buffer(matches[2], 'base64');
    // TODO - end - refactor later to separate function

    let temp = path.join(__dirname + "/pics", uuid.v1() + '.' + resource.type);
    console.log("========> temp file is: " + temp)
    fs.writeFileSync(temp, resource.data, { mode: '664' });

    console.log("====> about to call quagga!");

    Quagga.decodeSingle({
      // src: "/Users/cbo/FullStack/GroupProject3/CalSnap/controllers/pics/barcode.JPG",
      src: temp,
      numOfWorkers: 0,  // Needs to be 0 when used within node
      inputStream: {
        size: 800  // restrict input-size to be 800px in width (long-side)
      },
      decoder: {
        readers: [
          "ean_reader",
          // "code_39_reader",
          "ean_8_reader",
          "code_128_reader"
          // "upc_a_reader",
          // "upc_c_reader",
          // "I2of5_reader",
          // "2of5_reader",
          // "code_93_reader",
          // "codebar_reader",
          // "code_39_vin_reader"
        ], // List of active readers
        locate: true
      },
    }, function (result) {
      // no longer need the image file
      fs.unlink(temp, (err) => {
        if (err) console.log(`ERROR:  could not remove file: ${temp}`)
      })
      if (!result) {
        console.log(`*** no result from quagga.  Bailing!`)
        res.send({ code: "201", data: "ERROR: quagga blew up!" });
      } else {
        if (result.codeResult) {
          console.log(`=========> quagga result is: ${result.codeResult.code}`)

          nutritionixController.nutritionixBarcodeDirect(result.codeResult.code)
            .then(nutritionresponse => {
              // console.log(`==> got this back from nutritiionix and going back to the front: ${JSON.stringify(nutritionresponse)}`)
              res.send({ code: "000", data: nutritionresponse })
            })
            .catch(error => {
              console.log(`nutrionix error in combination with barcode reader is: ${error}`)
              res.send({ code: "200", data: "nutritionix error with barcode" })
            })
        } else {
          console.log(`***** ERROR: quagga not detected!  Result is: ${JSON.stringify(result)}`);
          res.send({ code: "201", data: "ERROR: barcode not detected!" });
        }
      }
    })
  },
  findbyId: function (req, res) {
    db.Food
      .find({ _id: req.params.id })
      .then(dbModel => {
        return res.json(dbModel)
      })
      .catch(err => res.status(422).json(err));
  },
  findAllbyUser: function (req, res) {
    db.Food
      .find({ username: req.params.username })
      .sort({ date: -1 })
      .then(dbModel => {
        return res.json(dbModel)
      })
      .catch(err => res.status(422).json(err));
  },
  findAllbyUserAndDateRange: function (req, res) {
    db.Food
      .find({ username: req.params.username, date_consumed: { "$gte": new Date(req.params.today), "$lt": new Date(req.params.tomorrow) } })
      .sort({ date_added: -1 })
      .then(dbModel => {
        return res.json(dbModel)
      })
      .catch(err => res.status(422).json(err));
  },
  findAllbyUserAndDateRangeAndMeal: function (req, res) {
    db.Food
      .find({ username: req.params.username, meal: req.params.meal, date_consumed: { "$gte": new Date(req.params.today), "$lt": new Date(req.params.tomorrow) } })
      .sort({ date_added: -1 })
      .then(dbModel => {
        return res.json(dbModel)
      })
      .catch(err => res.status(422).json(err));
  },
  create: function (req, res) {
    db.Food
      .create(req.body)
      .then(dbFood => {
        return db.User.findOneAndUpdate({ username: req.body.username }, { $push: { food: dbFood._id } })
      })
      .then(dbUser => res.json(dbUser))
      .catch(err => res.status(422).json(err));
  },
  update: function (req, res) {
    console.log(req.params.id);
    console.log(req.body);
    db.Food
      .findOneAndUpdate({ _id: req.params.id }, req.body)
      .then(dbModel => res.json(dbModel))
      .catch(err => res.status(422).json(err));
  },
  // Remove Food from User
  remove: function (req, res) {
    db.Food
      .findOneAndRemove({ _id: req.params.id })
      .then(dbFood => {
        return db.User.findOneAndUpdate({ username: dbFood.username }, { $pull: { food: dbFood._id } })
      })
      .then(dbUser => res.json(dbUser))
      .catch(err => res.status(422).json(err));
  },
  removeAllbyUser: function (req, res) {
    db.User
      .findOneAndUpdate({ username: req.params.username }, { $set: { food: [] } })
      .then(dbUser => {
        return db.Food.deleteMany({ username: dbUser.username })
      })
      .then(dbFood => res.json(dbFood))
      .catch(err => res.status(422).json(err));
  }
};
