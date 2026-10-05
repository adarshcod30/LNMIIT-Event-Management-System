// ================================================================
// scripts/seed.js: Database Seed Script
// ================================================================
// Populates the database with test data:
//   1 admin, 5 faculty, 20 students, 2 outsiders
//   15 events, 50 registrations, 5 teams, 10 event requests
// Run: npm run seed (from /backend directory)
// ================================================================

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { randomUUID: uuidv4 } = require('crypto');
const User = require('../models/User');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Team = require('../models/Team');
const EventRequest = require('../models/EventRequest');
const Notification = require('../models/Notification');

const crypto = require('crypto');

const MONGO_URI = process.env.MONGODB_URI;

async function seed() {
  // This script deletes every user, event and registration before it writes.
  // Refuse to run it against a production database.
  if (process.env.NODE_ENV === 'production') {
    console.error(' Refusing to seed: NODE_ENV is production and this script wipes the database.');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log(' Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}), Event.deleteMany({}), Registration.deleteMany({}),
      Team.deleteMany({}), EventRequest.deleteMany({}), Notification.deleteMany({}),
    ]);
    console.log('️  Cleared existing data');

    // ---- Create Users ----
    // No password is written in the source: use ADMIN_INITIAL_PASSWORD, or a random one
    const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || crypto.randomBytes(12).toString('base64url');
    const hashedPw = await bcrypt.hash(adminPassword, 12);

    const admin = await User.create({
      name: 'System Administrator', email: 'admin@lnmiit.ac.in',
      password: hashedPw, role: 'admin', mustChangePassword: true,
      isActive: true, profileComplete: true, department: 'CSE',
    });

    const facultyData = [
      { name: 'Dr. Vikas Bajpai', email: 'vikas.bajpai@lnmiit.ac.in', department: 'CSE' },
      { name: 'Dr. Rahul Sharma', email: 'rahul.sharma@lnmiit.ac.in', department: 'ECE' },
      { name: 'Dr. Priya Gupta', email: 'priya.gupta@lnmiit.ac.in', department: 'Mathematics' },
      { name: 'Dr. Amit Verma', email: 'amit.verma@lnmiit.ac.in', department: 'Physics' },
      { name: 'Dr. Neha Singh', email: 'neha.singh@lnmiit.ac.in', department: 'EE' },
    ];
    const faculty = await User.insertMany(facultyData.map(f => ({ ...f, role: 'faculty', isActive: true, profileComplete: true })));

    const studentData = [
      { name: 'Adarsh Kumar', email: '23ucs509@lnmiit.ac.in', rollNumber: '23UCS509', department: 'CSE' },
      { name: 'Ravi Singh', email: '23ucs101@lnmiit.ac.in', rollNumber: '23UCS101', department: 'CSE' },
      { name: 'Priya Patel', email: '22ece201@lnmiit.ac.in', rollNumber: '22ECE201', department: 'ECE' },
      { name: 'Amit Joshi', email: '23ucs205@lnmiit.ac.in', rollNumber: '23UCS205', department: 'CSE' },
      { name: 'Sneha Reddy', email: '22ece305@lnmiit.ac.in', rollNumber: '22ECE305', department: 'ECE' },
      { name: 'Rahul Meena', email: '21mec045@lnmiit.ac.in', rollNumber: '21MEC045', department: 'MME' },
      { name: 'Kavya Sharma', email: '23ucs310@lnmiit.ac.in', rollNumber: '23UCS310', department: 'CSE' },
      { name: 'Vikram Tiwari', email: '22ucs420@lnmiit.ac.in', rollNumber: '22UCS420', department: 'CSE' },
      { name: 'Ananya Gupta', email: '23ece102@lnmiit.ac.in', rollNumber: '23ECE102', department: 'ECE' },
      { name: 'Deepak Yadav', email: '21ucs330@lnmiit.ac.in', rollNumber: '21UCS330', department: 'CSE' },
      { name: 'Pooja Kumari', email: '22ucs115@lnmiit.ac.in', rollNumber: '22UCS115', department: 'CSE' },
      { name: 'Saurabh Jain', email: '23ucs440@lnmiit.ac.in', rollNumber: '23UCS440', department: 'CSE' },
      { name: 'Nisha Verma', email: '22ece410@lnmiit.ac.in', rollNumber: '22ECE410', department: 'ECE' },
      { name: 'Rohan Mishra', email: '21ucs220@lnmiit.ac.in', rollNumber: '21UCS220', department: 'CSE' },
      { name: 'Simran Kaur', email: '23ucs550@lnmiit.ac.in', rollNumber: '23UCS550', department: 'CSE' },
      { name: 'Arjun Nair', email: '22ucs330@lnmiit.ac.in', rollNumber: '22UCS330', department: 'CSE' },
      { name: 'Meghna Das', email: '23ece220@lnmiit.ac.in', rollNumber: '23ECE220', department: 'ECE' },
      { name: 'Tarun Agarwal', email: '21ucs440@lnmiit.ac.in', rollNumber: '21UCS440', department: 'CSE' },
      { name: 'Ishita Pandey', email: '22ucs550@lnmiit.ac.in', rollNumber: '22UCS550', department: 'CSE' },
      { name: 'Karan Thakur', email: '23ucs660@lnmiit.ac.in', rollNumber: '23UCS660', department: 'CSE' },
    ];
    const students = await User.insertMany(studentData.map(s => ({ ...s, role: 'student', isActive: true, profileComplete: true })));

    const outsiders = await User.insertMany([
      { name: 'John Smith', email: 'john.smith@gmail.com', role: 'outsider', isActive: true },
      { name: 'Sarah Johnson', email: 'sarah.j@outlook.com', role: 'outsider', isActive: true },
    ]);
    console.log(` Created ${1 + faculty.length + students.length + outsiders.length} users`);

    // ---- Create Events ----
    const now = new Date();
    const day = 24 * 60 * 60 * 1000;

    const eventsData = [
      {
        title: 'Plinth 2026 - Code Marathon', description: 'Annual 24-hour coding marathon organized by Plinth tech fest. Solve challenging algorithmic problems and compete for exciting prizes.',
        eventType: 'coding_contest', category: 'technical', organizer: faculty[0]._id,
        venue: 'Computer Lab 1', canonicalVenue: 'Computer Lab 1', rawVenueInput: 'CL-1',
        startDateTime: new Date(now.getTime() + 7 * day), endDateTime: new Date(now.getTime() + 8 * day),
        registrationDeadline: new Date(now.getTime() + 6 * day),
        eligibility: 'all_lnmiit', maxParticipants: 60, isTeamEvent: true, minTeamSize: 2, maxTeamSize: 3,
        tags: ['coding', 'plinth', 'competitive programming'], club: 'Plinth', status: 'approved',
        approvedBy: admin._id, approvedAt: now, isPublic: true, isPinned: true,
        prizes: [{ position: '1st', prize: 'Trophy + Cash', amount: 10000 }, { position: '2nd', prize: 'Cash', amount: 5000 }],
        rules: '1. Teams of 2-3 members\n2. Use any programming language\n3. Internet allowed for documentation only',
        contactEmail: 'plinth@lnmiit.ac.in',
      },
      {
        title: 'Workshop: Introduction to Machine Learning', description: 'Hands-on workshop covering basics of ML using Python, scikit-learn, and TensorFlow. Bring your laptop!',
        eventType: 'workshop', category: 'technical', organizer: faculty[0]._id,
        venue: 'Computer Lab 2', canonicalVenue: 'Computer Lab 2', rawVenueInput: 'CL-2',
        startDateTime: new Date(now.getTime() + 3 * day), endDateTime: new Date(now.getTime() + 3 * day + 4 * 3600000),
        registrationDeadline: new Date(now.getTime() + 2 * day),
        eligibility: 'students_only', maxParticipants: 50,
        tags: ['ML', 'AI', 'workshop', 'python'], status: 'approved',
        approvedBy: admin._id, approvedAt: now, isPublic: true,
      },
      {
        title: 'Vivacity Cultural Night', description: 'Annual cultural extravaganza featuring dance, music, and drama performances.',
        eventType: 'cultural', category: 'cultural', organizer: faculty[2]._id,
        venue: 'OAT', canonicalVenue: 'OAT', rawVenueInput: 'Open Air Theatre',
        startDateTime: new Date(now.getTime() + 14 * day), endDateTime: new Date(now.getTime() + 14 * day + 5 * 3600000),
        eligibility: 'open_to_all', maxParticipants: 800,
        tags: ['vivacity', 'cultural', 'dance', 'music'], club: 'Vivacity', status: 'approved',
        approvedBy: admin._id, approvedAt: now, isPublic: true, isPinned: true,
      },
      {
        title: 'Hackathon: Smart Campus Solutions', description: 'Build innovative solutions for smart campus management in 36 hours.',
        eventType: 'hackathon', category: 'technical', organizer: faculty[0]._id,
        venue: 'SAC', canonicalVenue: 'SAC', rawVenueInput: 'SAC Hall',
        startDateTime: new Date(now.getTime() + 10 * day), endDateTime: new Date(now.getTime() + 11.5 * day),
        registrationDeadline: new Date(now.getTime() + 9 * day),
        eligibility: 'all_lnmiit', maxParticipants: 100, isTeamEvent: true, minTeamSize: 3, maxTeamSize: 5,
        tags: ['hackathon', 'innovation', 'smart campus'], status: 'approved',
        approvedBy: admin._id, approvedAt: now, isPublic: true,
        prizes: [{ position: '1st', prize: 'Cash Prize', amount: 25000 }],
      },
      {
        title: 'Guest Lecture: Quantum Computing', description: 'Distinguished lecture by Dr. Rajesh from IIT Delhi on quantum computing fundamentals.',
        eventType: 'talk', category: 'academic', organizer: faculty[3]._id,
        venue: 'LT-1', canonicalVenue: 'LT-1', rawVenueInput: 'Lecture Theatre 1',
        startDateTime: new Date(now.getTime() + 5 * day), endDateTime: new Date(now.getTime() + 5 * day + 2 * 3600000),
        eligibility: 'open_to_all', maxParticipants: 120,
        tags: ['quantum', 'computing', 'physics', 'lecture'], status: 'approved',
        approvedBy: admin._id, approvedAt: now, isPublic: true,
      },
      {
        title: 'Desportivos Cricket Tournament', description: 'Inter-batch cricket tournament. Form your teams and compete!',
        eventType: 'sports', category: 'sports', organizer: faculty[1]._id,
        venue: 'Cricket Ground', canonicalVenue: 'Cricket Ground', rawVenueInput: 'Cricket Ground',
        startDateTime: new Date(now.getTime() + 20 * day), endDateTime: new Date(now.getTime() + 22 * day),
        registrationDeadline: new Date(now.getTime() + 18 * day),
        eligibility: 'students_only', maxParticipants: 110, isTeamEvent: true, minTeamSize: 11, maxTeamSize: 15,
        tags: ['cricket', 'sports', 'desportivos'], club: 'Desportivos', status: 'approved',
        approvedBy: admin._id, approvedAt: now, isPublic: true,
      },
      {
        title: 'Seminar: Research Methodology', description: 'Learn proper research methodology and paper writing techniques.',
        eventType: 'seminar', category: 'academic', organizer: faculty[2]._id,
        venue: 'Seminar Hall 1', canonicalVenue: 'Seminar Hall 1', rawVenueInput: 'SH-1',
        startDateTime: new Date(now.getTime() + 4 * day), endDateTime: new Date(now.getTime() + 4 * day + 3 * 3600000),
        eligibility: 'all_lnmiit', maxParticipants: 100,
        tags: ['research', 'academic', 'writing'], status: 'approved',
        approvedBy: admin._id, approvedAt: now, isPublic: true,
      },
      {
        title: 'CyberOps CTF Challenge', description: 'Capture The Flag cybersecurity competition. Test your hacking skills ethically!',
        eventType: 'coding_contest', category: 'technical', organizer: faculty[4]._id,
        venue: 'Computer Lab 3', canonicalVenue: 'Computer Lab 3', rawVenueInput: 'CL-3',
        startDateTime: new Date(now.getTime() + 12 * day), endDateTime: new Date(now.getTime() + 12 * day + 8 * 3600000),
        registrationDeadline: new Date(now.getTime() + 11 * day),
        eligibility: 'students_only', maxParticipants: 50, isTeamEvent: true, minTeamSize: 2, maxTeamSize: 4,
        tags: ['CTF', 'cybersecurity', 'hacking', 'cyberops'], club: 'CyberOps', status: 'approved',
        approvedBy: admin._id, approvedAt: now, isPublic: true,
      },
      {
        title: 'Robotics Workshop', description: 'Build and program your first robot using Arduino. All materials provided.',
        eventType: 'workshop', category: 'technical', organizer: faculty[1]._id,
        venue: 'Electronics Lab', canonicalVenue: 'Electronics Lab', rawVenueInput: 'ECE Lab',
        startDateTime: new Date(now.getTime() + 8 * day), endDateTime: new Date(now.getTime() + 8 * day + 6 * 3600000),
        registrationDeadline: new Date(now.getTime() + 7 * day),
        eligibility: 'students_only', maxParticipants: 30,
        tags: ['robotics', 'arduino', 'hardware'], club: 'Robotics Club', status: 'approved',
        approvedBy: admin._id, approvedAt: now, isPublic: true,
      },
      {
        title: 'DebSoc Annual Debate', description: 'Annual parliamentary debate competition. Topics announced on the day.',
        eventType: 'club_activity', category: 'cultural', organizer: faculty[2]._id,
        venue: 'LT-5', canonicalVenue: 'LT-5', rawVenueInput: 'LT 5',
        startDateTime: new Date(now.getTime() + 15 * day), endDateTime: new Date(now.getTime() + 15 * day + 4 * 3600000),
        eligibility: 'all_lnmiit', maxParticipants: 60, isTeamEvent: true, minTeamSize: 2, maxTeamSize: 2,
        tags: ['debate', 'debsoc', 'public speaking'], club: 'DebSoc', status: 'approved',
        approvedBy: admin._id, approvedAt: now, isPublic: true,
      },
      {
        title: 'Photography Walk', description: 'Guided photography walk around campus. Capture the beauty of LNMIIT.',
        eventType: 'club_activity', category: 'cultural', organizer: faculty[3]._id,
        venue: 'Main Lawn', canonicalVenue: 'Main Lawn', rawVenueInput: 'Central Lawn',
        startDateTime: new Date(now.getTime() + 6 * day), endDateTime: new Date(now.getTime() + 6 * day + 3 * 3600000),
        eligibility: 'all_lnmiit', maxParticipants: 40,
        tags: ['photography', 'vignette', 'campus'], club: 'Vignette', status: 'approved',
        approvedBy: admin._id, approvedAt: now, isPublic: true,
      },
      {
        title: 'Faculty Development Program', description: 'Workshop on modern teaching methodologies and ed-tech tools.',
        eventType: 'workshop', category: 'academic', organizer: admin._id,
        venue: 'Conference Hall 1 (Guest House)', canonicalVenue: 'Conference Hall 1 (Guest House)',
        startDateTime: new Date(now.getTime() + 25 * day), endDateTime: new Date(now.getTime() + 26 * day),
        eligibility: 'faculty_only', maxParticipants: 50,
        tags: ['FDP', 'teaching', 'faculty'], status: 'approved',
        approvedBy: admin._id, approvedAt: now, isPublic: false,
      },
      {
        title: 'Badminton Tournament', description: 'Singles and doubles badminton tournament. All skill levels welcome!',
        eventType: 'sports', category: 'sports', organizer: faculty[4]._id,
        venue: 'SAC Badminton Court 1', canonicalVenue: 'SAC Badminton Court 1',
        startDateTime: new Date(now.getTime() + 16 * day), endDateTime: new Date(now.getTime() + 17 * day),
        eligibility: 'all_lnmiit', maxParticipants: 32,
        tags: ['badminton', 'sports', 'tournament'], status: 'approved',
        approvedBy: admin._id, approvedAt: now, isPublic: true,
      },
      {
        title: 'Web Development Bootcamp', description: 'Learn full-stack web development with React and Node.js in this intensive bootcamp.',
        eventType: 'workshop', category: 'technical', organizer: faculty[0]._id,
        venue: 'Computer Lab 1', canonicalVenue: 'Computer Lab 1', rawVenueInput: 'CL 1',
        startDateTime: new Date(now.getTime() + 30 * day), endDateTime: new Date(now.getTime() + 32 * day),
        registrationDeadline: new Date(now.getTime() + 28 * day),
        eligibility: 'students_only', maxParticipants: 40,
        tags: ['web dev', 'react', 'nodejs', 'bootcamp'], status: 'approved',
        approvedBy: admin._id, approvedAt: now, isPublic: true,
      },
      {
        title: 'Past Event: Orientation Day', description: 'Freshman orientation and campus tour for new students.',
        eventType: 'general', category: 'administrative', organizer: admin._id,
        venue: 'SAC', canonicalVenue: 'SAC',
        startDateTime: new Date(now.getTime() - 30 * day), endDateTime: new Date(now.getTime() - 30 * day + 6 * 3600000),
        eligibility: 'all_lnmiit', status: 'completed', isPublic: true,
        tags: ['orientation', 'freshers'],
      },
    ];

    const events = await Event.insertMany(eventsData);
    console.log(` Created ${events.length} events`);

    // ---- Create Registrations ----
    const registrations = [];
    for (let i = 0; i < Math.min(50, students.length * events.length); i++) {
      const student = students[i % students.length];
      const event = events[i % events.length];
      // Skip if event is not accepting registrations or eligibility mismatch
      if (event.status !== 'approved' && event.status !== 'completed') continue;
      if (event.eligibility === 'faculty_only') continue;

      registrations.push({
        event: event._id, user: student._id, status: 'registered',
        checkInCode: uuidv4(), registeredAt: new Date(now.getTime() - Math.random() * 7 * day),
      });
    }
    // Add some outsider registrations for open events
    const openEvents = events.filter(e => e.eligibility === 'open_to_all');
    outsiders.forEach(o => {
      openEvents.forEach(e => {
        registrations.push({
          event: e._id, user: o._id, status: 'registered',
          checkInCode: uuidv4(), registeredAt: new Date(),
        });
      });
    });

    // Remove duplicates
    const uniqueRegs = [];
    const seen = new Set();
    registrations.forEach(r => {
      const key = `${r.event}-${r.user}`;
      if (!seen.has(key)) { seen.add(key); uniqueRegs.push(r); }
    });

    const createdRegs = await Registration.insertMany(uniqueRegs.slice(0, 50));
    console.log(` Created ${createdRegs.length} registrations`);

    // Update event registered counts
    for (const event of events) {
      const count = await Registration.countDocuments({ event: event._id, status: 'registered' });
      await Event.findByIdAndUpdate(event._id, { registeredCount: count });
    }

    // ---- Create Teams ----
    const teamEvents = events.filter(e => e.isTeamEvent);
    const teams = [];
    for (let i = 0; i < Math.min(5, teamEvents.length); i++) {
      const ev = teamEvents[i % teamEvents.length];
      const captain = students[i * 2];
      const memberIds = [captain._id];
      if (students[i * 2 + 1]) memberIds.push(students[i * 2 + 1]._id);
      if (students[i * 2 + 2] && ev.maxTeamSize >= 3) memberIds.push(students[i * 2 + 2]._id);

      teams.push({
        event: ev._id, name: `Team ${['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'][i]}`,
        captain: captain._id, members: memberIds,
        status: memberIds.length >= (ev.minTeamSize || 1) ? 'complete' : 'incomplete',
      });
    }
    const createdTeams = await Team.insertMany(teams);
    console.log(` Created ${createdTeams.length} teams`);

    // ---- Create Event Requests ----
    const requestData = [];
    for (let i = 0; i < 10; i++) {
      const student = students[i % students.length];
      requestData.push({
        submittedBy: student._id,
        requestType: 'create',
        eventData: {
          title: `Student Event Request ${i + 1}: ${['Gaming Night', 'Poetry Slam', 'Chess Tournament', 'Movie Screening', 'Tech Talk', 'Art Exhibition', 'Quiz Night', 'Music Jam', 'Dance Workshop', 'Startup Pitch'][i]}`,
          description: `A student-organized event at LNMIIT campus.`,
          eventType: ['general', 'cultural', 'sports', 'general', 'coding_contest'][i % 5],
          category: ['cultural', 'cultural', 'sports', 'cultural', 'technical'][i % 5],
          venue: ['LT-3', 'SAC', 'Main Lawn', 'LT-7', 'Computer Lab 2'][i % 5],
          canonicalVenue: ['LT-3', 'SAC', 'Main Lawn', 'LT-7', 'Computer Lab 2'][i % 5],
          startDateTime: new Date(now.getTime() + (i + 10) * day),
          endDateTime: new Date(now.getTime() + (i + 10) * day + 3 * 3600000),
          eligibility: 'all_lnmiit',
          maxParticipants: 50,
        },
        status: i < 5 ? 'pending' : (i < 8 ? 'approved' : 'rejected'),
        reviewedBy: i >= 5 ? admin._id : undefined,
        reviewedAt: i >= 5 ? now : undefined,
        rejectionReason: i >= 8 ? 'Venue not available on requested date' : '',
      });
    }
    const createdRequests = await EventRequest.insertMany(requestData);
    console.log(` Created ${createdRequests.length} event requests`);

    // ---- Create Sample Notifications ----
    const notifData = [];
    students.slice(0, 5).forEach(s => {
      notifData.push({
        recipient: s._id, type: 'registration_confirmed',
        title: 'Registration Confirmed', message: 'You have been registered for Plinth 2026 Code Marathon',
        link: `/events/${events[0]._id}`, isRead: false,
      });
    });
    await Notification.insertMany(notifData);
    console.log(` Created ${notifData.length} notifications`);

    console.log('\n Database seeded successfully!');
    console.log('\n Demo Login Emails:');
    console.log(`   Admin:   admin@lnmiit.ac.in (password: ${process.env.ADMIN_INITIAL_PASSWORD ? 'from ADMIN_INITIAL_PASSWORD' : adminPassword}, must be changed on first login)`);
    console.log('   Faculty: vikas.bajpai@lnmiit.ac.in');
    console.log('   Student: 23ucs509@lnmiit.ac.in');
    console.log('   Outsider: john.smith@gmail.com\n');

    process.exit(0);
  } catch (error) {
    console.error(' Seed error:', error);
    process.exit(1);
  }
}

seed();
