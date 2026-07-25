import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import env from '../src/config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    await connection.query("INSERT IGNORE INTO roles (name) VALUES ('admin'), ('staff')");
    await connection.query('INSERT IGNORE INTO hospital_settings (id) VALUES (1)');
    for (const [key, value] of Object.entries(DEFAULT_CONTENT)) {
      await connection.query('INSERT IGNORE INTO site_content (content_key, content_value) VALUES (?, ?)', [key, value]);
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
