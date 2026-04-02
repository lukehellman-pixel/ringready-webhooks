const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const CAL_API_KEY = 'cal_live_85d88d0c093a2c1c1c055a7fa445fe70';
const EVENT_TYPE_ID = 5094224;

// Indianapolis offset: EDT (UTC-4) Mar-Nov, EST (UTC-5) Nov-Mar
function getIndianapolisOffset(date) {
  const year = date.getUTCFullYear();
  const dstStart = new Date(Date.UTC(year, 2, 8 + (7 - new Date(Date.UTC(year, 2, 1)).getUTCDay()) % 7, 7)); // 2nd Sun Mar 2am EST = 7am UTC
  const dstEnd   = new Date(Date.UTC(year, 10,    (7 - new Date(Date.UTC(year, 10, 1)).getUTCDay()) % 7 + 1, 6)); // 1st Sun Nov 2am EDT = 6am UTC
  return (date >= dstStart && date < dstEnd) ? '-04:00' : '-05:00';
}

// CHECK AVAILABILITY
app.post('/check-availability', async (req, res) => {
  try {
    const args = req.body.args || req.body;
    const startTime = args.start_time;

    let targetDate;
    if (startTime) {
      targetDate = new Date(startTime);
    } else {
      targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 1);
    }

    const offset = getIndianapolisOffset(targetDate);
    // Use local date components based on the offset
    const offsetHours = parseInt(offset); // -4 or -5
    const localMs = targetDate.getTime() + offsetHours * 3600000;
    const local = new Date(localMs);
    const dayOfWeek = local.getUTCDay();

    if (dayOfWeek === 0) {
      return res.json({ slots: [], message: "Salon is closed on Sundays" });
    }

    const closingHour = (dayOfWeek === 5 || dayOfWeek === 6) ? 18 : 21;
    const slots = [];
    const year  = local.getUTCFullYear();
    const month = String(local.getUTCMonth() + 1).padStart(2, '0');
    const day   = String(local.getUTCDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    for (let hour = 9; hour < closingHour; hour++) {
      const displayHour = hour > 12 ? hour - 12 : hour;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      slots.push({
        time: `${dateStr}T${String(hour).padStart(2, '0')}:00:00${offset}`,
        display: `${displayHour}:00 ${ampm}`
      });
    }

    res.json({ slots });
  } catch (err) {
    console.error('Check availability error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// BOOK APPOINTMENT
app.post('/book-appointment', async (req, res) => {
  try {
    const args = req.body.args || req.body;
    console.log('Booking args:', JSON.stringify(args));
    
    const startTime = args.start || args.start_time;
    const startDate = new Date(startTime);

    const bookingData = {
      eventTypeId: EVENT_TYPE_ID,
      start: startDate.toISOString(),
      timeZone: 'America/Indiana/Indianapolis',
      language: 'en',
      metadata: {},
      responses: {
        name: args.name || 'Guest',
        email: args.email || 'guest@example.com',
        attendeePhoneNumber: args.phone || '',
        location: { value: 'integrations:daily', optionValue: '' },
        notes: args.notes || ''
      }
    };
    
    console.log('Sending to Cal.com:', JSON.stringify(bookingData));
    
    const response = await axios.post(
      `https://api.cal.com/v1/bookings?apiKey=${CAL_API_KEY}`,
      bookingData
    );
    
    res.json({
      success: true,
      booking_id: response.data.id,
      message: 'Booking confirmed'
    });
  } catch (err) {
    console.error('Booking error:', err.response?.data || err.message);
    res.status(500).json({ 
      error: err.message,
      details: err.response?.data 
    });
  }
});

// SEND BOOKING LINK VIA TWILIO SMS
const TWILIO_ACCOUNT_SID   = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN    = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_MESSAGING_SID = process.env.TWILIO_MESSAGING_SID;

app.post('/send-booking-link', async (req, res) => {
  try {
    const args = req.body.args || req.body;
    const name = args.name || 'there';
    const phone = args.phone || args.phone_number;

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number required' });
    }

    const bookingUrl = 'https://kkbbsalon.com/#onlinebookings';
    const message = `Hi ${name}! Here's your booking link for Kiss Kiss Bang Bang Salon: ${bookingUrl}`;

    const params = new URLSearchParams();
    params.append('To', phone);
    params.append('MessagingServiceSid', TWILIO_MESSAGING_SID);
    params.append('Body', message);

    await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      params.toString(),
      {
        auth: { username: TWILIO_ACCOUNT_SID, password: TWILIO_AUTH_TOKEN },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    res.json({ success: true, message: 'Booking link sent via text' });
  } catch (err) {
    console.error('Send booking link error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/', (req, res) => res.send('RingReady webhooks running'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
