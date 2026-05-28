import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Service } from './src/models/Service.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");
  
  // Find a service and make it official
  const service = await Service.findOne({});
  if (service) {
    service.isSentinalOfficial = true;
    await service.save();
    console.log("Made service official:", service.title);
  } else {
    console.log("No services found");
  }
  
  process.exit(0);
}

run();
