const mongoose = require("mongoose");

// Schema for coding challenge problems
const problemSchema = new mongoose.Schema({
    // Title of the coding problem
    title: {
        type: String,
        required: true,
        trim: true
    },
    // Detailed problem description
    description: {
        type: String,
        required: true
    },
    // Explanation of input format for the problem
    inputFormat: {
        type: String,
        default: ''
    },
    // Explanation of expected output format
    outputFormat: {
        type: String,
        default: ''
    },
    // Sample input for demonstration
    sampleInput: {
        type: String,
        default: ''
    },
    // Expected output for the sample input
    sampleOutput: {
        type: String,
        default: ''
    },
    // Array of test cases with input and expected output
    testCases: [
        {
            input: String,
            expectedOutput: String
        }
    ],
    // Difficulty level of the problem
    difficulty: {
        type: String,
        enum: ['Easy', 'Medium', 'Hard'],
        default: 'Medium',
        required: true
    },
    // Track which admin created this problem
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

module.exports = mongoose.model("Problem", problemSchema);