import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useContent, useUpdateContent } from '../../../hooks/useContent.js';
import { getPhotoUrl } from '../../../utils/photoUrl.js';
import ImageUploadField from '../../../components/admin/ImageUploadField.jsx';

const SECTIONS = [
  {
    title: 'Hero',
    fields: [
      { key: 'hero_title', label: 'Hero Title', type: 'input' },
      { key: 'hero_subtitle', label: 'Hero Subtitle', type: 'textarea' },
    ],
  },
  {
    title: 'Trust Strip',
    fields: [
      { key: 'trust_line_1', label: 'Trust Line 1', type: 'input' },
      { key: 'trust_line_2', label: 'Trust Line 2', type: 'input' },
      { key: 'trust_line_3', label: 'Trust Line 3', type: 'input' },
    ],
  },
  {
    title: 'Home — About Section',
    fields: [
      { key: 'home_about_heading', label: 'Heading', type: 'input' },
      { key: 'home_about_body', label: 'Body', type: 'textarea' },
    ],
  },
  {
    title: 'Home — Why Choose Us (4 Points)',
    fields: [
      { key: 'why_title_1', label: 'Point 1 Title', type: 'input' },
      { key: 'why_body_1', label: 'Point 1 Body', type: 'textarea' },
      { key: 'why_title_2', label: 'Point 2 Title', type: 'input' },
      { key: 'why_body_2', label: 'Point 2 Body', type: 'textarea' },
      { key: 'why_title_3', label: 'Point 3 Title', type: 'input' },
      { key: 'why_body_3', label: 'Point 3 Body', type: 'textarea' },
      { key: 'why_title_4', label: 'Point 4 Title', type: 'input' },
      { key: 'why_body_4', label: 'Point 4 Body', type: 'textarea' },
    ],
  },
  {
    title: 'Home — Section Headings',
    fields: [
      { key: 'home_services_heading', label: 'Services Preview Heading', type: 'input' },
      { key: 'home_doctors_heading', label: 'Doctors Preview Heading', type: 'input' },
      { key: 'home_testimonials_heading', label: 'Testimonials Preview Heading', type: 'input' },
      { key: 'home_contact_heading', label: 'Contact Strip Heading', type: 'input' },
    ],
  },
  {
    title: 'Services Page',
    fields: [
      { key: 'services_page_heading', label: 'Heading', type: 'input' },
      { key: 'services_page_subheading', label: 'Subheading', type: 'input' },
    ],
  },
  {
    title: 'Doctors Page',
    fields: [
      { key: 'doctors_page_heading', label: 'Heading', type: 'input' },
      { key: 'doctors_page_subheading', label: 'Subheading', type: 'input' },
    ],
  },
  {
    title: 'Testimonials Page',
    fields: [
      { key: 'testimonials_page_heading', label: 'Heading', type: 'input' },
      { key: 'testimonials_page_subheading', label: 'Subheading', type: 'input' },
    ],
  },
  {
    title: 'Contact Page',
    fields: [
      { key: 'contact_page_heading', label: 'Heading', type: 'input' },
      { key: 'contact_page_subheading', label: 'Subheading', type: 'input' },
    ],
  },
  {
    title: 'Footer',
    fields: [{ key: 'footer_tagline', label: 'Footer Tagline', type: 'input' }],
  },
];

const ALL_KEYS = SECTIONS.flatMap((section) => section.fields.map((field) => field.key));
const DEFAULT_VALUES = Object.fromEntries(ALL_KEYS.map((key) => [key, '']));

export default function SiteContentForm() {
  const { data: content, isLoading } = useContent();
  const updateContent = useUpdateContent();

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm({ defaultValues: DEFAULT_VALUES });

  const [heroImageFile, setHeroImageFile] = useState(null);
  const [heroImagePreview, setHeroImagePreview] = useState(null);

  useEffect(() => {
    if (content) {
      reset(Object.fromEntries(ALL_KEYS.map((key) => [key, content[key] ?? ''])));
      setHeroImagePreview(getPhotoUrl(content.hero_image_url));
    }
  }, [content, reset]);

  function handleHeroImageChange(file) {
    setHeroImageFile(file);
    setHeroImagePreview(URL.createObjectURL(file));
  }

  function handleHeroImageClear() {
    setHeroImageFile(null);
    setHeroImagePreview(getPhotoUrl(content?.hero_image_url) ?? null);
  }

  async function onSubmit(values) {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => formData.append(key, value));
    if (heroImageFile) formData.append('hero_image', heroImageFile);

    try {
      await updateContent.mutateAsync(formData);
      setHeroImageFile(null);
      toast.success('Site content updated');
    } catch (err) {
      toast.error(err.message || 'Failed to save site content.');
    }
  }

  if (isLoading) {
    return <div className="text-slate-500">Loading...</div>;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold text-slate-800">Site Content</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {SECTIONS.map((section) => (
          <fieldset key={section.title} className="space-y-4 rounded-lg bg-white p-6 shadow">
            <legend className="mb-2 px-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {section.title}
            </legend>
            {section.fields.map((field) => (
              <div key={field.key}>
                <label className="mb-1 block text-sm font-medium text-slate-700">{field.label}</label>
                {field.type === 'textarea' ? (
                  <textarea
                    rows="3"
                    className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    {...register(field.key, { required: 'Required', maxLength: { value: 2000, message: 'Too long' } })}
                  />
                ) : (
                  <input
                    type="text"
                    className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    {...register(field.key, { required: 'Required', maxLength: { value: 2000, message: 'Too long' } })}
                  />
                )}
              </div>
            ))}
            {section.title === 'Hero' && (
              <ImageUploadField
                label="Hero Photo"
                preview={heroImagePreview}
                onChange={handleHeroImageChange}
                onClear={heroImageFile ? handleHeroImageClear : undefined}
                hint="Shown in the homepage hero. Portrait orientation works best. JPG, PNG or WEBP, up to 5MB."
              />
            )}
          </fieldset>
        ))}

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save Site Content'}
          </button>
        </div>
      </form>
    </div>
  );
}
