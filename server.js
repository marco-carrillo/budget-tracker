//*********************************************************/
//  Program dependent on express (to manage routes) and   */
//  mongoose (to manage MongoDB data access).             */
//*********************************************************/
const express = require("express");
const logger = require("morgan");
const mongoose = require("mongoose");
const compression = require("compression");

//************************/
//  Setting up express   */
//************************/
const app = express();
app.use(logger("dev"));
app.use(compression());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("./public"));

//*********************************************************/
//  Setting up an environmental variable to check whether */
//  this instance will run locally or in Heroku           */
//*********************************************************/
let PORT = process.env.PORT || 5000;
let uristring=
  process.env.MONGODB_URI ||
  "mongodb://localhost/budget";

//************************/
//  Setting up Mongoose  */
//************************/
mongoose.connect(uristring, function (err,res) {
  if(err){
    console.log (`ERROR connecting to ${uristring}.  Error: ${err}`);
  } else {
    console.log(`Succeeded connected to ${uristring}`);
  }
});

//***********************/
// Requiring our routes */
//***********************/
app.use(require("./routes/api.js"));

//********************************/
//  Listening for assigned port  */
//********************************/
app.listen(PORT, () => {
  console.log(`App running on port ${PORT}!`);
});