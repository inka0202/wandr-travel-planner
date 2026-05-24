import mongoose from 'mongoose';

const attractionSchema = new mongoose.Schema(
  {
    xid: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    kind: { type: String, trim: true },
    address: { type: String, trim: true },
  },
  { _id: true, timestamps: false },
);

const tripSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    destination: {
      name: { type: String, required: true, trim: true },
      country: { type: String, trim: true },
      latitude: { type: Number, required: true, min: -90, max: 90 },
      longitude: { type: Number, required: true, min: -180, max: 180 },
    },
    startDate: { type: Date, required: true },
    endDate: {
      type: Date,
      required: true,
      validate: {
        validator: function (v) {
          return v >= this.startDate;
        },
        message: 'endDate must be on or after startDate',
      },
    },
    notes: { type: String, trim: true, maxlength: [1000, 'notes cannot exceed 1000 characters'] },
    savedAttractions: { type: [attractionSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

tripSchema.index({ user: 1, createdAt: -1 }); // "list this user's trips, newest first"

export default mongoose.model('Trip', tripSchema);
