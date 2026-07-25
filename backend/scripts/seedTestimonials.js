import pool from '../src/config/db.js';

const DEFAULT_TESTIMONIALS = [
  {
    patient_name: 'Ramesh Kumar',
    review:
      'After my knee surgery, I could barely walk without pain. The physiotherapy team here got me back on my feet in just 6 weeks. Truly grateful for their patience and expertise.',
    rating: 5,
  },
  {
    patient_name: 'Priya Sharma',
    review:
      'I suffered from chronic back pain for years. The manual therapy sessions and personalized exercise plan made a huge difference within a month.',
    rating: 5,
  },
  {
    patient_name: 'Anitha Reddy',
    review:
      'The staff explained every step of my recovery process and were always available to answer my questions. Highly recommend for post-surgery rehab.',
    rating: 5,
  },
  {
    patient_name: 'Suresh Babu',
    review:
      "My father's mobility improved so much after just a few sessions of geriatric physiotherapy. The team is patient and caring with elderly patients.",
    rating: 5,
  },
  {
    patient_name: 'Kavya Nair',
    review:
      'Excellent care for my sports injury. I was back on the field faster than I expected, and they made sure I would not re-injure myself.',
    rating: 4,
  },
  {
    patient_name: 'Mohammed Irfan',
    review:
      'Professional, friendly, and genuinely invested in my recovery. The electrotherapy sessions helped manage my pain significantly.',
    rating: 4,
  },
];

async function seedTestimonials() {
  const [[{ count }]] = await pool.query('SELECT COUNT(*) AS count FROM testimonials');
  if (count > 0) {
    console.log('Testimonials table is not empty. Skipping.');
    return;
  }

  for (const testimonial of DEFAULT_TESTIMONIALS) {
    await pool.query('INSERT INTO testimonials (patient_name, review, rating, photo_url) VALUES (:patient_name, :review, :rating, NULL)', testimonial);
  }

  console.log(`Seeded ${DEFAULT_TESTIMONIALS.length} default testimonials.`);
}

seedTestimonials()
  .catch((err) => {
    console.error('Seeding testimonials failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
