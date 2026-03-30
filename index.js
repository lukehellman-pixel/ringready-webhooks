const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const CAL_API_KEY = 'cal_live_85d88d0c093a2c1c1c055a7fa445fe70';
const EVENT_TYPE_ID = 5094224;

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
    
    const dayOfWeek = targetDate.getDay();
    
    if (dayOfWeek === 0) {
      return res.json({ slots: [], message: "Salon is closed on Sundays" });
    }
    
    const closingHour = (dayOfWeek === 5 || dayOfWeek === 6) ? 18 : 21;
    const slots = [];
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    for (let hour = 9; hour < closingHour; hour++) {
      const displayHour = hour > 12 ? hour - 12 : (hour === 12 ? 12 : hour);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      slots.push({
        time: `${dateStr}T${String(hour).padStart(2,'0')}:00:00.000Z`,
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
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    
    const bookingData = {
      eventTypeId: EVENT_TYPE_ID,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      timeZone: 'America/Indiana/Indianapolis',
      language: 'en',
      metadata: {},
      responses: {
        name: args.name || 'Guest',
        email: args.email || 'guest@example.com',
        phone: args.phone || '0000000000',
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

app.get('/', (req, res) => res.send('RingReady webhooks running'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
