import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Search } from 'lucide-react';
import { geocodeCity } from '@/api/geocode';
import { FormField } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { addDaysISO, todayISO } from '@/lib/dates';
import { endDateError, maxEndISO, maxStartISO, startDateError } from '@/lib/tripDates';

export default function SearchBar({ variant = 'hero' }) {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm({
    mode: 'onBlur',
    defaultValues: {
      destination: '',
      startDate: todayISO(),
      endDate: addDaysISO(todayISO(), 7),
    },
  });

  const startDate = watch('startDate');
  // Same limits as the server's "Save trip" check. The form is noValidate, so min/max only limit
  // the date picker; the validate rules below also catch typed dates.
  const today = todayISO();
  const endMax = maxEndISO(startDate) ?? undefined;

  const onSubmit = async (form) => {
    setSubmitError(null);
    try {
      const results = await geocodeCity(form.destination.trim());
      const top = results[0];
      const params = new URLSearchParams({
        name: top.name,
        country: top.country ?? '',
        lat: String(top.latitude),
        lng: String(top.longitude),
        tz: top.timezone,
        start: form.startDate,
        end: form.endDate,
      });
      navigate(`/search?${params.toString()}`);
    } catch (err) {
      const code = err.response?.data?.error?.code;
      if (code === 'GEOCODE_NO_RESULTS') {
        setSubmitError(`We couldn't find "${form.destination}". Try a different spelling.`);
      } else {
        setSubmitError('Something went wrong. Try again.');
      }
    }
  };

  const isHero = variant === 'hero';

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className={
        isHero
          ? 'grid gap-3 rounded-2xl bg-white p-4 shadow-card sm:grid-cols-[2fr_1fr_1fr_auto] sm:gap-4 sm:p-6'
          : 'grid gap-2 rounded-lg bg-white p-3 shadow-soft sm:grid-cols-[2fr_1fr_1fr_auto] sm:gap-3'
      }
    >
      <FormField
        label="Destination"
        placeholder="Paris, Tokyo, New York…"
        error={errors.destination?.message}
        {...register('destination', {
          required: 'Where are you going?',
          maxLength: { value: 100, message: 'Too long' },
        })}
      />
      <FormField
        label="Start date"
        type="date"
        min={today}
        max={maxStartISO()}
        error={errors.startDate?.message}
        {...register('startDate', {
          required: 'Required',
          validate: (val) => startDateError(val) ?? true,
          deps: ['endDate'], // re-check the end date when the start changes
        })}
      />
      <FormField
        label="End date"
        type="date"
        min={startDate || today}
        max={endMax}
        error={errors.endDate?.message}
        {...register('endDate', {
          required: 'Required',
          validate: (val, all) => endDateError(all.startDate, val) ?? true,
        })}
      />
      <div className="flex items-end">
        <Button type="submit" variant="primary" disabled={isSubmitting} fullWidth>
          {isSubmitting ? (
            'Searching…'
          ) : (
            <>
              <Search size={18} className="mr-1 inline" /> Search
            </>
          )}
        </Button>
      </div>

      {submitError && (
        <div role="alert" className="text-sm text-red-700 sm:col-span-4">
          {submitError}
        </div>
      )}
    </form>
  );
}
