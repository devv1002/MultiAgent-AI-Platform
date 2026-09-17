import express from "express"
import proxy from "express-http-proxy";
import dotenv from "dotenv"
dotenv.config()
import cors from "cors"
import cookieParser from "cookie-parser";

import { getCurrentUser } from "./controllers/user.controller.js"
import protect from "./middleware/auth.middleware.js"

const port = process.env.PORT;

const app = express()

app.use(cors({
    origin:process.env.FRONTEND_URL,
    credentials:true
}))

app.use(cookieParser())
//middleware for GATEWAY & SERVICES Connection
app.use("/auth", proxy(process.env.AUTH_SERVICE))


app.get("/me",protect,getCurrentUser)
app.get("/",(req,res) => {
    res.json({message: "Hello from gateway"})
})

app.listen(port, () => {
    console.log(`gateway started at ${port}`);
})