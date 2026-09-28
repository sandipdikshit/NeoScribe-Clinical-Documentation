import express, {Request, Response} from "express";
import morgan from "morgan";
// import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import helmet from "helmet";
import "./db/models/index";
import i18n from "i18n";
import { resolve } from "path";
import cors from "cors";

dotenv.config();

const port = process.env.PORT || 3001;
const app = express();

app.use(express.json());

// for logging
app.use(morgan("dev"));
app.use(helmet());

const allowCredential = {
    credentials: true,
    origin: (process.env.CORS_ORIGINS || "http://localhost:3000")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
};

app.use(cors(allowCredential));

// localisation setup
i18n.configure({
    locales : ['en'],
    directory : resolve(__dirname,"locales"),
    defaultLocale : "en",
    queryParameters : "lang",
    objectNotation : true 
})
app.use(i18n.init);

// Entry API
app.get('/', ( req: Request, res: Response) => {
    res.send("Welcome to Neoscribe Authentication");
})

// Load Routes
var authenticationRoutes = require("./routes/v1/authentication/routes");

app.use("/api/authentication",authenticationRoutes);

//Server Listening
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`) 
})

module.exports = app; 
