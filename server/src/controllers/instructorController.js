import bcrypt from 'bcryptjs';
import Joi from 'joi';
import { Instructor } from '../models/Instructor.js';

const loginSchema = Joi.object({
  username: Joi.string().trim().min(1).max(50).required(),
  password: Joi.string().min(1).max(128).required()
}).unknown(false);

const searchSchema = Joi.object({
  name: Joi.string().trim().min(1).max(80),
  username: Joi.string().trim().min(1).max(50),
  department: Joi.string().trim().min(1).max(80),
  role: Joi.string().valid('instructor', 'superadmin')
}).unknown(false);


function publicProfile(doc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    username: doc.username,
    department: doc.department,
    role: doc.role
  };
}

// POST /api/instructors/login
export async function loginInstructor(req, res, next) {
  try {
    const { value, error } = loginSchema.validate(req.body);

    if (error) {
      return res.status(400).json({ message: 'Invalid input' });
    }

    const instructor = await Instructor.findOne({
      username: value.username
    }).select('+password');

    if (!instructor) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(
      value.password,
      instructor.password
    );

    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    return res.json({
      instructor: publicProfile(instructor)
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/instructors
export async function getDirectory(req, res, next) {
  try {
    const instructors = await Instructor.find()
      .select('name department role')
      .sort({ name: 1 })
      .lean();

    res.json({ instructors });
  } catch (err) {
    next(err);
  }
}

// GET /api/instructors/search
// GET /api/instructors/search
export async function searchInstructors(req, res, next) {
  try {
    // Only accept known fields containing plain strings.
    // Ignore objects and unknown parameters.
    const allowedFields = ['name', 'username', 'department', 'role'];
    const input = {};

    for (const field of allowedFields) {
      if (typeof req.query[field] === 'string') {
        input[field] = req.query[field];
      }
    }

    const { value, error } = searchSchema.validate(input);

    if (error) {
      return res.status(400).json({ message: 'Invalid search parameters' });
    }

    const filter = {};

    if (value.name) {
      const escapedName = value.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.name = { $regex: escapedName, $options: 'i' };
    }

    if (value.username) filter.username = value.username;
    if (value.department) filter.department = value.department;
    if (value.role) filter.role = value.role;

    const instructors = await Instructor.find(filter)
      .select('name department role')
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      count: instructors.length,
      instructors
    });
  } catch (err) {
    next(err);
  }
}
