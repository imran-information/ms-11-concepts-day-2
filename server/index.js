const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
require('dotenv').config()

const port = process.env.PORT || 9000
const app = express()

const corsOrigin = {
  origin: ['http://localhost:5173'],
  credentials: true,
  optionalSuccessStatus: 200
}

app.use(cors(corsOrigin))
app.use(express.json())
app.use(cookieParser())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.eedxn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

const tokenVerify = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.USER_SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded;
  })

  next()
}



async function run() {
  try {
    // Send a ping to confirm a successful connection
    // await client.db('admin').command({ ping: 1 })
    const db = client.db("soloSphere")
    const jobsCollections = db.collection('jobs')
    const bidsCollections = db.collection('bids')

    // JWT Authentication 
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.USER_SECRET_KEY, {
        expiresIn: '1d'
      })
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      })
        .send({ success: true })
    })
    // JWT logout 
    app.get('/logout', async (req, res) => {
      res.clearCookie('token', {
        maxAge: 0,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      })
        .send({ success: true })
    })




    app.post('/add-job', async (req, res) => {
      const newJob = req.body;
      const result = await jobsCollections.insertOne(newJob);
      res.send(result)

    })

    app.get('/jobs', async (req, res) => {
      const result = await jobsCollections.find().toArray()
      res.send(result)
    })


    app.get('/jobs/:email', tokenVerify, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.user?.email
      const query = { 'bayer.email': email }
      if (decodedEmail !== email) {
        return res.status(401).send({ message: 'unauthorized access' })
      }
      const result = await jobsCollections.find(query).toArray()
      res.send(result)
    })

    app.delete('/job/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await jobsCollections.deleteOne(query);
      res.send(result)
    })
    app.get('/job/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await jobsCollections.findOne(query);
      res.send(result)
    })

    app.put('/update-job/:id', async (req, res) => {
      const id = req.params.id;
      const jobData = req.body;
      const query = { _id: new ObjectId(id) }
      const updatedJob = {
        $set: jobData

      }
      const options = { upsert: true }
      const result = await jobsCollections.updateOne(query, updatedJob, options);
      res.send(result)
    })

    // add bids 
    app.post('/add-bid', async (req, res) => {
      const bidData = req.body;

      const alreadyExist = await bidsCollections.findOne({ email: bidData.email, id: bidData.id })
      if (alreadyExist) {
        return res.status(400).send('You have already Bid on this job...!')
      }

      const result = await bidsCollections.insertOne(bidData)

      const id = bidData.id
      const filter = { _id: new ObjectId(id) }
      const updateCount = {
        $inc: {
          bit_count: 1
        }
      }
      const updateBidCount = jobsCollections.updateOne(filter, updateCount)
      res.send(result)
    })

    // get bids specific user 
    app.get('/bids/:email', async (req, res) => {
      const email = req.params.email;
      const bayerEmail = req.query.bayerEmail;
      let filter = {}
      if (bayerEmail) {
        filter.bayerEmail = email
      } else {
        filter.email = email
      }
      // const filter = { email }
      const result = await bidsCollections.find(filter).toArray();
      res.send(result)
    })

    app.patch('/status-updated/:id', async (req, res) => {
      const id = req.params.id;
      const { currentStatus } = req.body;
      const filter = { _id: new ObjectId(id) }
      const statusUpdate = {
        $set: {
          status: currentStatus
        }
      }
      const result = await bidsCollections.updateOne(filter, statusUpdate)
      res.send(result)
    })


    app.get('/all-jobs', async (req, res) => {
      const filter = req.query.filter
      const search = req.query.search
      const sort = req.query.sort
      let options = {}

      if (sort) options = { sort: { deadline: sort === 'asc' ? 1 : -1 } }
      let query = {
        title: {
          $regex: search,
          $options: 'i'
        }
      }
      if (filter) query.category = filter

      const result = await jobsCollections.find(query, options).toArray()
      res.send(result)
    })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)
app.get('/', (req, res) => {
  res.send('Hello from SoloSphere Server....')
})

app.listen(port, () => console.log(`Server running on port ${port}`))
