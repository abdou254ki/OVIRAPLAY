const normalizePhone = v => {
  const digits=String(v||'').replace(/\D/g,'');
  if(/^00213[5-7]\d{8}$/.test(digits))return digits.slice(2);
  if(/^0[5-7]\d{8}$/.test(digits))return '213'+digits.slice(1);
  if(/^213[5-7]\d{8}$/.test(digits))return digits;
  return digits;
};
function matchesHistoricalPurchase(order,customer){
  const email=!!order.customerEmail && !!customer.email && order.customerEmail.trim().toLowerCase()===customer.email.trim().toLowerCase();
  const phone=!!order.whatsappNumber && !!customer.phone && normalizePhone(order.whatsappNumber)===normalizePhone(customer.phone);
  return {email,phone,verified:(email&&customer.emailVerified)||(phone&&customer.phoneVerified)};
}
module.exports={normalizePhone,matchesHistoricalPurchase};
