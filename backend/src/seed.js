// Populates the database with demo accounts and sample CRM data.
// WARNING: clears existing users, leads, contacts, tasks and activities.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Lead = require('./models/Lead');
const Contact = require('./models/Contact');
const Task = require('./models/Task');
const Activity = require('./models/Activity');

const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD;
const day = 24 * 60 * 60 * 1000;

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('Set MONGODB_URI before seeding the database.');
  if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 16) {
    throw new Error('Set SEED_ADMIN_PASSWORD to a unique value of at least 16 characters before seeding.');
  }
  if (!DEMO_PASSWORD || DEMO_PASSWORD.length < 16) {
    throw new Error('Set SEED_DEMO_PASSWORD to a unique value of at least 16 characters before seeding.');
  }
  await mongoose.connect(uri);
  await Promise.all([User.deleteMany({}), Lead.deleteMany({}), Contact.deleteMany({}), Task.deleteMany({}), Activity.deleteMany({})]);

  const admin = await User.create({
    name: 'Sagar Admin',
    email: 'admin@crm.test',
    username: 'admin',
    password: ADMIN_PASSWORD,
    role: 'superadmin',
  });
  const manager = await User.create({ name: 'Divya Manager', email: 'manager@crm.test', password: DEMO_PASSWORD, role: 'manager' });
  const agent1 = await User.create({ name: 'Prashant Agent', email: 'agent1@crm.test', password: DEMO_PASSWORD, role: 'agent' });
  const agent2 = await User.create({ name: 'Rahul Agent', email: 'agent2@crm.test', password: DEMO_PASSWORD, role: 'agent' });

  const sample = [
    ['Aarav Mehta', 'Mehta Textiles', 'Website', 'New'],
    ['Priya Nair', 'Nair Logistics', 'Referral', 'Contacted'],
    ['Rohan Gupta', 'Gupta Foods', 'Cold Call', 'Qualified'],
    ['Sneha Kapoor', 'Kapoor Designs', 'Social Media', 'Converted'],
    ['Vikram Singh', 'Singh Motors', 'Event', 'New'],
    ['Ananya Iyer', 'Iyer Pharma', 'Email Campaign', 'Contacted'],
    ['Karan Malhotra', 'Malhotra Realty', 'Website', 'Qualified'],
    ['Isha Verma', 'Verma Education', 'Referral', 'Converted'],
    ['Manish Tiwari', 'Tiwari Agro', 'Cold Call', 'Lost'],
    ['Neha Joshi', 'Joshi Clinics', 'Website', 'New'],
    ['Arjun Reddy', 'Reddy Infra', 'Event', 'Contacted'],
    ['Pooja Sharma', 'Sharma Boutique', 'Social Media', 'Qualified'],
    ['Deepak Yadav', 'Yadav Hardware', 'Other', 'New'],
    ['Meera Pillai', 'Pillai Travels', 'Referral', 'Converted'],
    ['Sahil Khanna', 'Khanna Electronics', 'Email Campaign', 'Lost'],
  ];

  const agents = [agent1, agent2];
  const leads = [];
  for (let i = 0; i < sample.length; i += 1) {
    const [name, organization, source, stage] = sample[i];
    const slug = name.toLowerCase().replace(/\s+/g, '.');
    const created = new Date(Date.now() - (sample.length - i) * 4 * day);
    // eslint-disable-next-line no-await-in-loop
    const lead = await Lead.create({
      name,
      organization,
      source,
      stage,
      email: `${slug}@example.com`,
      phone: `98${String(10000000 + i * 137).slice(0, 8)}`,
      assignedTo: agents[i % 2]._id,
      createdBy: manager._id,
      notes: 'Sample lead created by seed script.',
      createdAt: created,
    });
    leads.push(lead);
    // eslint-disable-next-line no-await-in-loop
    await Activity.create({ lead: lead._id, user: manager._id, type: 'created', notes: 'Lead created' });
    if (stage !== 'New') {
      // eslint-disable-next-line no-await-in-loop
      await Activity.create({ lead: lead._id, user: agents[i % 2]._id, type: 'call', notes: 'Initial call completed.' });
      // eslint-disable-next-line no-await-in-loop
      await Activity.create({ lead: lead._id, user: agents[i % 2]._id, type: 'stage_change', notes: `Stage changed from New to ${stage}` });
    }
    // eslint-disable-next-line no-await-in-loop
    await Contact.create({ name, organization, email: `${slug}@example.com`, lead: lead._id, createdBy: manager._id });
  }

  const taskTitles = ['Send proposal', 'Follow-up call', 'Schedule demo', 'Share pricing sheet', 'Collect requirements', 'Send contract draft'];
  for (let i = 0; i < 12; i += 1) {
    const lead = leads[i];
    // eslint-disable-next-line no-await-in-loop
    await Task.create({
      title: `${taskTitles[i % taskTitles.length]} - ${lead.name}`,
      description: 'Sample follow-up task.',
      dueDate: new Date(Date.now() + (i - 3) * day),
      assignedTo: lead.assignedTo,
      lead: lead._id,
      priority: ['Low', 'Medium', 'High'][i % 3],
      status: i % 4 === 0 ? 'Completed' : i % 4 === 1 ? 'In Progress' : 'Pending',
      completedAt: i % 4 === 0 ? new Date() : undefined,
      createdBy: manager._id,
    });
  }

  console.log('Seed complete. Demo accounts:');
  console.log(`  ${admin.role.padEnd(10)} username: admin (password supplied through SEED_ADMIN_PASSWORD)`);
  [manager, agent1, agent2].forEach((u) => console.log(`  ${u.role.padEnd(10)} ${u.email} (password supplied through SEED_DEMO_PASSWORD)`));
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
