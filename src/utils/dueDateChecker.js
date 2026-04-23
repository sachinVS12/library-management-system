const cron = require("node-cron");
const Borrow = require("../models/Borrow");
const User = require("../models/User");
const sendEmail = require("./emailService"); // You'll need to implement this

// Run every day at 9 AM
const startDueDateChecker = () => {
  cron.schedule("0 9 * * *", async () => {
    console.log("Running due date checker...");

    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const threeDaysLater = new Date();
    threeDaysLater.setDate(today.getDate() + 3);

    try {
      // Check for books due tomorrow
      const dueTomorrow = await Borrow.find({
        status: "borrowed",
        dueDate: {
          $gte: tomorrow.setHours(0, 0, 0, 0),
          $lte: tomorrow.setHours(23, 59, 59, 999),
        },
      }).populate("user book");

      for (const borrow of dueTomorrow) {
        // Send email notification
        if (borrow.user.email) {
          await sendEmail({
            to: borrow.user.email,
            subject: "Book Due Tomorrow - Library Management System",
            html: `
              <h3>Dear ${borrow.user.name},</h3>
              <p>This is a reminder that your borrowed book "${borrow.book.title}" is due tomorrow (${borrow.dueDate.toLocaleDateString()}).</p>
              <p>Please return it on time to avoid late fees.</p>
              <p>Thank you for using our library!</p>
            `,
          });
        }
      }

      // Check for overdue books and update status
      const overdueBooks = await Borrow.find({
        status: "borrowed",
        dueDate: { $lt: today },
      });

      for (const borrow of overdueBooks) {
        borrow.status = "overdue";
        borrow.fine = borrow.calculateFine();
        await borrow.save();

        // Update user's outstanding balance
        const user = await User.findById(borrow.user);
        if (user) {
          user.outstandingBalance += borrow.fine;
          await user.save();
        }
      }

      console.log(`Processed ${dueTomorrow.length} due tomorrow reminders`);
      console.log(`Updated ${overdueBooks.length} overdue books`);
    } catch (error) {
      console.error("Error in due date checker:", error);
    }
  });

  console.log("Due date checker started");
};

module.exports = startDueDateChecker;
