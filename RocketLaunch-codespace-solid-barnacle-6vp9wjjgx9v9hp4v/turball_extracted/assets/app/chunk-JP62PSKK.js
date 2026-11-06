function o(n){const e=document.querySelector('meta[name="content-base"]')?.content||"/content/";const t=new URL(e.endsWith("/")?e:e+"/",location.href);return new URL(n,t).href}export{o as a};
