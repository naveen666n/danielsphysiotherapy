import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import env from '../src/config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('Running db migrations..');
const DEFAULT_CONTENT = {
  hero_title: 'Expert Physiotherapy Care You Can Trust',
  hero_subtitle: 'Personalized treatment plans to help you move, heal, and live pain-free.',
  trust_line_1: 'Qualified & Experienced Doctors',
  trust_line_2: 'Modern Treatment Techniques',
  trust_line_3: 'Personalized Patient Care',
  home_about_heading: 'Why Patients Choose Us',
  home_about_body:
    "At Daniel's Physiotherapy Hospital, we combine expert clinical care with a warm, patient-first approach — helping you recover safely and get back to the life you love.",
  why_title_1: 'Expert Care',
  why_body_1: 'Treatment plans built around your specific condition and recovery goals.',
  why_title_2: 'Modern Equipment',
  why_body_2: 'Evidence-based techniques and equipment for effective, lasting recovery.',
  why_title_3: 'Personalized Attention',
  why_body_3: 'Every patient gets focused, one-on-one attention throughout their treatment.',
  why_title_4: 'Convenient Hours',
  why_body_4: 'Flexible scheduling that fits around your daily routine.',
  home_services_heading: 'Our Services',
  home_doctors_heading: 'Meet Our Doctors',
  home_testimonials_heading: 'What Our Patients Say',
  home_contact_heading: 'Visit Us',
  services_page_heading: 'Our Services',
  services_page_subheading: 'Comprehensive physiotherapy treatments tailored to your needs.',
  doctors_page_heading: 'Meet Our Doctors',
  doctors_page_subheading: 'Experienced specialists dedicated to your recovery.',
  testimonials_page_heading: 'Patient Stories',
  testimonials_page_subheading: "Hear from patients we've helped recover.",
  contact_page_heading: 'Get In Touch',
  contact_page_subheading: "We'd love to hear from you — reach out with any questions.",
  footer_tagline: 'Compassionate physiotherapy care for lasting recovery.',
};

const DEFAULT_SERVICES = [
  {
    name: 'Sports Injury Rehabilitation',
    description:
      'Assessment and recovery programs for sprains, strains, ligament tears, and other sports-related injuries.',
    display_order: 1,
  },
  {
    name: 'Post-Surgery Rehabilitation',
    description:
      'Guided recovery plans after orthopedic or joint-replacement surgery to restore strength and mobility safely.',
    display_order: 2,
  },
  {
    name: 'Back & Neck Pain Therapy',
    description:
      'Targeted treatment for chronic back pain, cervical spondylosis, sciatica, and posture-related discomfort.',
    display_order: 3,
  },
  {
    name: 'Manual Therapy & Joint Mobilization',
    description: 'Hands-on techniques to relieve stiffness, improve joint range of motion, and reduce muscular tension.',
    display_order: 4,
  },
  {
    name: 'Electrotherapy & Pain Management',
    description:
      'TENS, ultrasound, and other modalities used alongside exercise therapy to manage acute and chronic pain.',
    display_order: 5,
  },
  {
    name: 'Neuro Rehabilitation',
    description:
      'Physiotherapy for stroke, paralysis, and other neurological conditions, focused on regaining movement and independence.',
    display_order: 6,
  },
  {
    name: 'Pediatric Physiotherapy',
    description: 'Developmental and mobility support for children with delayed milestones or movement difficulties.',
    display_order: 7,
  },
  {
    name: 'Geriatric Physiotherapy',
    description: 'Balance training, fall-prevention, and mobility care tailored to the needs of elderly patients.',
    display_order: 8,
  },
];

async function migrate() {
  const schemaPath = path.join(__dirname, '../src/config/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    multipleStatements: true,
  });

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\``);
    await connection.query(`USE \`${env.DB_NAME}\``);
    await connection.query(schema);

    const [existingColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'appointments' AND COLUMN_NAME = 'service_id'`,
      [env.DB_NAME]
    );
    if (existingColumns.length === 0) {
      await connection.query('ALTER TABLE appointments ADD COLUMN service_id INT AFTER doctor_id');
      await connection.query(
        'ALTER TABLE appointments ADD CONSTRAINT fk_appointments_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL'
      );
      console.log('Added service_id column to appointments.');
    }

    const [existingVideoFeeColumn] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'doctors' AND COLUMN_NAME = 'video_consultation_fee'`,
      [env.DB_NAME]
    );
    if (existingVideoFeeColumn.length === 0) {
      await connection.query('ALTER TABLE doctors ADD COLUMN video_consultation_fee DECIMAL(10,2) AFTER consultation_fee');
      await connection.query(
        'ALTER TABLE doctors ADD COLUMN video_consultation_zoom_link VARCHAR(500) AFTER video_consultation_fee'
      );
      console.log('Added video_consultation_fee and video_consultation_zoom_link columns to doctors.');
    }

    const [existingThemeColumn] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'hospital_settings' AND COLUMN_NAME = 'site_theme'`,
      [env.DB_NAME]
    );
    if (existingThemeColumn.length === 0) {
      await connection.query(
        "ALTER TABLE hospital_settings ADD COLUMN site_theme VARCHAR(20) NOT NULL DEFAULT 'premium' AFTER social_links"
      );
      console.log('Added site_theme column to hospital_settings.');
    }

    const [existingDoctorEmailColumn] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'doctors' AND COLUMN_NAME = 'email'`,
      [env.DB_NAME]
    );
    if (existingDoctorEmailColumn.length === 0) {
      await connection.query('ALTER TABLE doctors ADD COLUMN email VARCHAR(150) AFTER name');
      console.log('Added email column to doctors.');
    }

    const [existingMapEmbedColumn] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'hospital_settings' AND COLUMN_NAME = 'map_embed_url'`,
      [env.DB_NAME]
    );
    if (existingMapEmbedColumn.length === 0) {
      await connection.query('ALTER TABLE hospital_settings ADD COLUMN map_embed_url VARCHAR(1000) AFTER google_map_link');
      console.log('Added map_embed_url column to hospital_settings.');
    }

    await connection.query("INSERT IGNORE INTO roles (name) VALUES ('admin'), ('staff')");
    await connection.query('INSERT IGNORE INTO hospital_settings (id) VALUES (1)');
    for (const [key, value] of Object.entries(DEFAULT_CONTENT)) {
      await connection.query('INSERT IGNORE INTO site_content (content_key, content_value) VALUES (?, ?)', [key, value]);
    }

    const [[{ count: serviceCount }]] = await connection.query('SELECT COUNT(*) AS count FROM services');
    if (serviceCount === 0) {
      for (const service of DEFAULT_SERVICES) {
        await connection.query('INSERT INTO services (name, description, display_order) VALUES (?, ?, ?)', [
          service.name,
          service.description,
          service.display_order,
        ]);
      }
      console.log(`Seeded ${DEFAULT_SERVICES.length} default services.`);
    }

    console.log(`Database schema applied successfully to "${env.DB_NAME}".`);
  } finally {
    await connection.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
