const mongoose = require('mongoose');

const todoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [250, 'Title cannot exceed 250 characters']
    },
    category: {
      type: String,
      enum: ['Personal', 'Work', 'Learning', 'Shopping'],
      default: 'Personal'
    },
    dueDate: {
      type: String,
      default: () => new Date().toISOString().split('T')[0]
    },
    important: {
      type: Boolean,
      default: false
    },
    completed: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Map _id to id in JSON output for seamless frontend compatibility
todoSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.models.Todo || mongoose.model('Todo', todoSchema);
