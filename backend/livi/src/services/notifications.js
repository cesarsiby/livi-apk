export async function enqueueNotification(c,{userId,type,title,body,data={},channels=['in_app']}){
  const notification=(await c.query(
    `INSERT INTO notifications(user_id,type,title,body,data) VALUES($1,$2,$3,$4,$5) RETURNING id,user_id,type,title,body,data,created_at`,
    [userId,type,title,body,data]
  )).rows[0];
  for(const channel of channels){
    await c.query(
      `INSERT INTO notification_outbox(notification_id,channel) VALUES($1,$2)`,
      [notification.id,channel]
    );
  }
  return notification;
}
