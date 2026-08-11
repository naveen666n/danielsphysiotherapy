import AppError from '../utils/AppError.js';
import * as videoConsultationRepository from '../repositories/videoConsultationRepository.js';
import * as doctorRepository from '../repositories/doctorRepository.js';
import * as paymentService from '../payments/paymentService.js';

function toCreateRow(data) {
  return {
    patient_name: data.patient_name,
    mobile: data.mobile,
    email: data.email ?? null,
    doctor_id: data.doctor_id,
    consultation_date: data.consultation_date,
    consultation_time: data.consultation_time,
    problem_description: data.problem_description ?? null,
    status: 'pending_payment',
  };
}

export async function listConsultations(filters) {
  return videoConsultationRepository.findAll(filters);
}

export async function getConsultation(id) {
  const consultation = await videoConsultationRepository.findById(id);
  if (!consultation) {
    throw new AppError('Video consultation not found.', 404);
  }
  return consultation;
}

export async function createOrder(data) {
  const doctor = await doctorRepository.findById(data.doctor_id);
  if (!doctor || !doctor.active) {
    throw new AppError('Selected doctor does not exist.', 400);
  }
  if (!doctor.video_consultation_fee || !doctor.video_consultation_zoom_link) {
    throw new AppError('Selected doctor does not offer video consultations.', 400);
  }

  const consultationId = await videoConsultationRepository.create(toCreateRow(data));

  const payment = await paymentService.createOrder({
    payableType: 'video_consultation',
    payableId: consultationId,
    amount: Number(doctor.video_consultation_fee),
    currency: 'INR',
    receipt: `vc_${consultationId}`,
  });

  await videoConsultationRepository.update(consultationId, { payment_id: payment.paymentId });

  return {
    consultationId,
    gatewayOrderId: payment.gatewayOrderId,
    amount: payment.amount,
    currency: payment.currency,
    keyId: payment.keyId,
    doctorName: doctor.name,
  };
}

export async function verifyPayment(id, { gatewayOrderId, gatewayPaymentId, signature }) {
  const consultation = await getConsultation(id);
  if (consultation.status === 'paid') {
    throw new AppError('This consultation has already been paid for.', 409);
  }
  const doctor = await doctorRepository.findById(consultation.doctor_id);

  try {
    await paymentService.verifyAndCapture({
      gatewayOrderId,
      gatewayPaymentId,
      signature,
      payableType: 'video_consultation',
      payableId: id,
    });
  } catch (err) {
    await videoConsultationRepository.update(id, { status: 'failed' });
    throw err;
  }

  await videoConsultationRepository.update(id, {
    status: 'paid',
    zoom_link: doctor.video_consultation_zoom_link,
  });

  return getConsultation(id);
}

export async function updateConsultation(id, data) {
  await getConsultation(id);
  await videoConsultationRepository.update(id, data);
  return getConsultation(id);
}
