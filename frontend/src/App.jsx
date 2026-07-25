import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import NotFound from './pages/NotFound.jsx';
import PublicBooking from './pages/PublicBooking.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import AdminHome from './pages/admin/AdminHome.jsx';
import DoctorList from './pages/admin/doctors/DoctorList.jsx';
import DoctorForm from './pages/admin/doctors/DoctorForm.jsx';
import AppointmentList from './pages/admin/appointments/AppointmentList.jsx';
import StaffList from './pages/admin/staff/StaffList.jsx';
import StaffForm from './pages/admin/staff/StaffForm.jsx';
import ServiceList from './pages/admin/services/ServiceList.jsx';
import ServiceForm from './pages/admin/services/ServiceForm.jsx';
import TestimonialList from './pages/admin/testimonials/TestimonialList.jsx';
import TestimonialForm from './pages/admin/testimonials/TestimonialForm.jsx';
import SettingsForm from './pages/admin/settings/SettingsForm.jsx';
import ContactMessageList from './pages/admin/contact/ContactMessageList.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/book" element={<PublicBooking />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminHome />} />
          <Route path="doctors" element={<DoctorList />} />
          <Route path="appointments" element={<AppointmentList />} />
          <Route path="services" element={<ServiceList />} />
          <Route path="testimonials" element={<TestimonialList />} />
          <Route path="messages" element={<ContactMessageList />} />
          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="doctors/new" element={<DoctorForm />} />
            <Route path="doctors/:id/edit" element={<DoctorForm />} />
            <Route path="staff" element={<StaffList />} />
            <Route path="staff/new" element={<StaffForm />} />
            <Route path="staff/:id/edit" element={<StaffForm />} />
            <Route path="services/new" element={<ServiceForm />} />
            <Route path="services/:id/edit" element={<ServiceForm />} />
            <Route path="testimonials/new" element={<TestimonialForm />} />
            <Route path="testimonials/:id/edit" element={<TestimonialForm />} />
            <Route path="settings" element={<SettingsForm />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
