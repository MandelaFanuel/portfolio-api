// const nodemailer = require('nodemailer');

// export default async function handler(req, res) {
//   if (req.method !== 'POST') {
//     return res.status(405).json({ error: 'Method not allowed' });
//   }

//   const { name, email, subject, message } = req.body;

//   // Configuration du transporteur email
//   const transporter = nodemailer.createTransporter({
//     service: 'gmail',
//     auth: {
//       user: process.env.EMAIL_USER,
//       pass: process.env.EMAIL_PASSWORD,
//     },
//   });

//   try {
//     // Envoyer l'email
//     await transporter.sendMail({
//       from: email,
//       to: 'mandela.fanuel.1@gmail.com',
//       subject: `Portfolio Contact: ${subject}`,
//       html: `
//         <h2>Nouveau message de contact</h2>
//         <p><strong>De:</strong> ${name} (${email})</p>
//         <p><strong>Sujet:</strong> ${subject}</p>
//         <p><strong>Message:</strong></p>
//         <p>${message}</p>
//       `,
//     });

//     res.status(200).json({ success: true });
//   } catch (error) {
//     console.error('Error sending email:', error);
//     res.status(500).json({ error: 'Failed to send message' });
//   }
// }