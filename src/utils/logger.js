function info(message, meta) {
  if (meta) {
    console.log(message, meta);
    return;
  }
  console.log(message);
}

function error(message, meta) {
  if (meta) {
    console.error(message, meta);
    return;
  }
  console.error(message);
}

module.exports = {
  info,
  error
};
