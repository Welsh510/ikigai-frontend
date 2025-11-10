// utils/dateUtils.js - NEW FILE
const getMalaysiaDateTime = () => {
  const now = new Date();
  // Convert to Malaysia time (GMT+8)
  const malaysiaTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  return malaysiaTime;
};

const getMalaysiaDateString = () => {
  const malaysiaTime = getMalaysiaDateTime();
  return malaysiaTime.toISOString().slice(0, 19).replace('T', ' ');
};

const getMalaysiaDateOnly = () => {
  const malaysiaTime = getMalaysiaDateTime();
  return malaysiaTime.toISOString().slice(0, 10);
};

const formatMalaysiaDateTime = (date) => {
  if (!date) return null;
  const malaysiaTime = new Date(new Date(date).getTime() + (8 * 60 * 60 * 1000));
  return malaysiaTime.toISOString().slice(0, 19).replace('T', ' ');
};

module.exports = {
  getMalaysiaDateTime,
  getMalaysiaDateString,
  getMalaysiaDateOnly,
  formatMalaysiaDateTime
};
