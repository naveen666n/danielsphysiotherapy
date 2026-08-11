import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AppError from '../utils/AppError.js';
import * as doctorRepository from '../repositories/doctorRepository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '../uploads');

function buildPhotoUrl(file) {
  return file ? `/uploads/doctors/${file.filename}` : null;
}

async function deletePhotoFile(photoUrl) {
  if (!photoUrl) return;
  const filePath = path.join(UPLOADS_ROOT, photoUrl.replace('/uploads/', ''));
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`Failed to delete photo file ${filePath}:`, err.message);
    }
  }
}

function toRow(data, photoUrl) {
  return {
    name: data.name,
    qualification: data.qualification ?? null,
    specialization: data.specialization ?? null,
    experience_years: data.experience_years ?? null,
    photo_url: photoUrl,
    consultation_fee: data.consultation_fee ?? null,
    video_consultation_fee: data.video_consultation_fee ?? null,
    video_consultation_zoom_link: data.video_consultation_zoom_link ?? null,
    working_days: data.working_days ?? null,
    available_time: data.available_time ?? null,
    active: data.active ?? true,
  };
}

export async function listDoctors() {
  return doctorRepository.findAll();
}

export async function listPublicDoctors() {
  const doctors = await doctorRepository.findActiveOnly();
  return doctors.map(({ video_consultation_zoom_link, ...rest }) => rest);
}

export async function getDoctor(id) {
  const doctor = await doctorRepository.findById(id);
  if (!doctor) {
    throw new AppError('Doctor not found.', 404);
  }
  return doctor;
}

export async function createDoctor(data, file) {
  const doctor = toRow(data, buildPhotoUrl(file));
  const id = await doctorRepository.create(doctor);
  return getDoctor(id);
}

export async function updateDoctor(id, data, file) {
  const existing = await getDoctor(id);

  const photoUrl = file ? buildPhotoUrl(file) : existing.photo_url;
  const doctor = toRow(data, photoUrl);
  await doctorRepository.update(id, doctor);

  if (file) {
    await deletePhotoFile(existing.photo_url);
  }

  return getDoctor(id);
}

export async function deleteDoctor(id) {
  const doctor = await getDoctor(id);
  try {
    await doctorRepository.remove(id);
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
      throw new AppError('Cannot delete a doctor with existing appointments. Deactivate the doctor instead.', 409);
    }
    throw err;
  }
  await deletePhotoFile(doctor.photo_url);
}
