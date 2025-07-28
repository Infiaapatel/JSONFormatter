
import { Component} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { configService } from './Services/config.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: true,
  styleUrl: './app.component.css',
  imports: [RouterOutlet, ]
})
export class AppComponent{
  configLoaded = false;
  apiBaseUrl = '';

 

  constructor(private configService: configService) { }

  ngOnInit() {
    this.loadConfig();
  }  

  loadConfig() {
    this.configService.loadConfig().subscribe({
      next: (config) => {
        this.configLoaded = true;
        this.apiBaseUrl = config.apiBaseUrl;
      },
      error: (err) => {
        throw err;
      },
    });
  }

  refreshConfig() {
    this.configService.refreshConfig().subscribe({
      next: (config) => {
        this.apiBaseUrl = config.apiBaseUrl;
      },
      error: (err) => {
        throw err;
      },
    });
  }
}
