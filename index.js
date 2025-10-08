require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");
const nodemailer = require("nodemailer");
const port = process.env.PORT || 5200;
const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5200"],
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

// user buildingDB
// pass 9cyr4iLTPy9fT6lK

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.BUILDING_DB_USER}:${process.env.BUILDING_DB_PASS}@cluster0.xt5rphe.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {

    // jwt token
    app.post('/jwt', (req, res)=>{
        const user = req.body
        const token = jwt.sign(user, process.env.JWT_TOKEN_SECRET, {expiresIn:"30d"})
        res.send({token});
    })


















    app.get("/", (req, res) => {
      res.send("building app running");
    });

    app.listen(port, () => {
      console.log(`building app listening on port ${port}`);
    });

    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.dir);
