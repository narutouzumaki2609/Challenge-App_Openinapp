import expresss from 'express';
import dotenv from 'dotenv';
dotenv.config();
import router from './routes.js';

const server=expresss();

server.get('/',async(req,res)=>{
    res.status(200).send("Welocome to Gmail API with NodeJS PROEJCT BY BHARTI");
})
server.use('/api',router);
server.listen(process.env.PORT, ()=>{
    console.log("listening on port "+process.env.PORT);
});