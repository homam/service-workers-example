const printMyIP = res => {
  console.log('====', res);
  document.getElementById("info").innerHTML = res;
};

fetch('https://api.ipify.org').then(x => x.text())
.then(printMyIP)
.catch(e => console.error(e))
