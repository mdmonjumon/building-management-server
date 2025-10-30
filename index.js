require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");
const nodemailer = require("nodemailer");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5200;
const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5200"],
  })
);

// middleware
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

// verify jwt token
const verifyToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  const token = req.headers.authorization.split(" ")[1];

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  jwt.verify(token, process.env.JWT_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    } else {
      req.user = decoded;
      next();
    }
  });
};

// dollar to cent
const handleDollarToCent = (value) => {
  if (value < 1) {
    return value;
  }
  return value * 100;
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.BUILDING_DB_USER}:${process.env.BUILDING_DB_PASS}@cluster0.xt5rphe.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// database collections
const db = client.db("apartmentsDB");
const apartmentsCollection = db.collection("apartments");
const agreementsCollection = db.collection("agreements");
const usersCollection = db.collection("users");
const couponsCollection = db.collection("coupon");

async function run() {
  try {
    // jwt token
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_TOKEN_SECRET, {
        expiresIn: "30d",
      });
      res.send({ token });
    });

    // store USER INFO in DB
    app.post("/users", async (req, res) => {
      const userInfo = req.body;
      const result = await usersCollection.insertOne(userInfo);
      res.send(result);
    });

    // get APARTMENTS data
    app.get("/apartments", async (req, res) => {
      const page = parseInt(req?.query?.pages);
      const minRent = parseInt(req?.query?.min);
      const maxRent = parseInt(req?.query?.max);
      let query = {};
      if (minRent && maxRent) {
        query = { rent: { $gte: minRent, $lte: maxRent } };
      }
      const totalApartments =
        await apartmentsCollection.estimatedDocumentCount();
      const result = await apartmentsCollection
        .find(query)
        .skip((page - 1) * 6)
        .limit(6)
        .toArray();
      res.send({ result, totalApartments });
    });

    // store AGREEMENT INFO in DB
    app.post("/agreement", verifyToken, async (req, res) => {
      const agreementInfo = req.body;
      const email = req?.user?.email;
      if (email !== agreementInfo?.userEmail) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const isExist = await agreementsCollection.findOne({ userEmail: email });
      console.log(isExist);
      if (isExist) {
        console.log("exist");
        return res.status(400).send({ message: "You have already agreement." });
      }
      const result = await agreementsCollection.insertOne({
        ...agreementInfo,
        status: "pending",
      });
      res.send(result);
    });

    // get agreement data for specific user
    app.get("/agreement/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await agreementsCollection.findOne({ userEmail: email });
      res.send(result);
    });

    // get coupon data
    app.get("/coupons", async (req, res) => {
      const result = await couponsCollection.find().toArray();
      res.send(result);
    });

    // get single coupon data
    app.get("/coupon/:id", verifyToken, async (req, res) => {
      const couponId = req.params.id;
      const result = await couponsCollection.findOne({ coupon_id: couponId });
      res.send(result);
    });

    // save payments info in db
    

    // create payment intent
    app.post("/payment-intent", verifyToken, async (req, res) => {
      const paymentInfo = req.body;
      const couponQuery = { coupon_id: paymentInfo?.couponId };
      const apartmentQuery = { apartmentId: paymentInfo?.apartmentId };
      const apartment = await agreementsCollection.findOne(apartmentQuery);
      const coupon = await couponsCollection.findOne(couponQuery);
      let amount = apartment?.rent;
      if (coupon) {
        if (coupon?.discount_type === "percentage") {
          amount = amount - (apartment?.rent * coupon?.value) / 100;
        }
        if (coupon?.discount_type === "fixed_amount") {
          amount = amount - coupon?.value;
        }
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: handleDollarToCent(amount),
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.send({ clientSecret: paymentIntent?.client_secret });
    });

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
    // await client.close();
  }
}
run().catch(console.dir);
