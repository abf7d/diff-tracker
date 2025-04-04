import {
  compareUrls,
  strapiUrls,
  dashboardUrls,
  domainTeamsUrls,
} from './url-list';

import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnInit,
  Renderer2,
  ChangeDetectorRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, AfterViewInit {
  baseUrls: string[] = [
    'https://covid.clinicalcohort.org',
    'https://n3c-opendata-dev.ncats.nih.gov/covid',
  ];

  compareUrls: string[][] = compareUrls;

  strapiUrls: (string | null)[][] = strapiUrls;
  dashboardUrls: (string | null)[][] = dashboardUrls;
  domainTeamsUrls: (string | null)[][] = domainTeamsUrls;

  tableRows: CompareRow[] = [];
  leftUrlSafe!: SafeResourceUrl;
  rightUrlSafe!: SafeResourceUrl;
  leftUrl: string = '';
  rightUrl: string = '';
  snapshotFile: string = '';
  isExpanded = true;
  isTextExpanded = false;
  hideImage = false;
  hideLocal = false;

  @ViewChild('leftIframe') leftIframeRef!: ElementRef<HTMLIFrameElement>;
  @ViewChild('rightIframe') rightIframeRef!: ElementRef<HTMLIFrameElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  constructor(
    private sanitizer: DomSanitizer,
    private change: ChangeDetectorRef,
    private http: HttpClient,
  ) {}

  ngOnInit() {
    // this.buildTableRows();
    this.tableRows = this.buildSmallerTableRows();
    this.loadLocalStorage();
    this.change.detectChanges();
  }

  // next run the app locally and compare
  buildSmallerTableRows(): CompareRow[] {
    this.hideImage = true;
    this.dashboardUrls.forEach((x) => x.push('dashboard'));
    this.strapiUrls.forEach((x) => x.push('strapi'));
    this.domainTeamsUrls.forEach((x) => x.push('domainTeams'));

    return this.dashboardUrls
      .concat(this.strapiUrls)
      .concat(this.domainTeamsUrls)
      .map((entry, i) => {
        const route = entry[1];

        let filenameBase = entry[1] ?? 'snapshot';
        let lastTwo = null;
        let localUrl = null;

        if (route) {
          lastTwo = this.getLastTwoSegments(route);
          localUrl = `http://localhost:4200${route}`;
        }
        // filenameBase = i + '-' + routeSegment + '-' + filenameBase;

        // const routeName = lastTwo; //this.getLastNonNumberSegment(route);
        // const snapshotName = `${i}-${routeSegment}-snapshot`;
        // const snapshotFile = `${filenameBase}.diff.png`;
        const fullUrl1 = entry[0]; //this.baseUrls[0] + route;
        const fullUrl2 = localUrl;
        const row: CompareRow = {
          route: route ?? 'missing',
          routeName: lastTwo,
          // routeName: lastTwo ?? 'missing ' + fullUrl1,
          snapshotName: `${i}-snapshot`,
          snapshotFile: entry[2] ?? 'snapshotFile',
          fullUrl1: fullUrl1 ?? 'missing',
          fullUrl2: fullUrl2 ?? 'missing',
          reviewed: false,
          error: false,
          notes: '',
          snapshotExists: false,
          filenameBase: filenameBase,
          lastClicked: false,
          fixed: false,
        };
        this.checkSnapshotFileSync(row);
        return row;
      });
  }

  // Build table rows from compareUrls; add default properties for reviewed and error.
  buildTableRows() {
    this.tableRows = this.compareUrls.map((entry, i) => {
      const route = entry[0];

      let filenameBase = entry[1] ?? 'snapshot';
      const routeSegment = this.getLastNonNumberSegment(route);
      filenameBase = i + '-' + routeSegment + '-' + filenameBase;

      const routeName = this.getLastNonNumberSegment(route);
      const snapshotName = `${i}-${routeSegment}-snapshot`;
      const snapshotFile = `${filenameBase}.diff.png`;
      const fullUrl1 = this.baseUrls[0] + route;
      const fullUrl2 = this.baseUrls[1] + route;
      const row: CompareRow = {
        route,
        routeName,
        snapshotName: snapshotName,
        snapshotFile,
        fullUrl1,
        fullUrl2,
        reviewed: false,
        error: false,
        notes: '',
        snapshotExists: false,
        filenameBase: filenameBase,
        lastClicked: false,
        fixed: false,
      };
      // this.checkSnapshotFileSync(row);
      return row;
    });
  }

  // Helper: Returns the last segment in the URL that is not purely numeric.
  getLastNonNumberSegment(url: string): string {
    const segments = url.split('/').filter((segment) => segment !== '');
    for (let i = segments.length - 1; i >= 0; i--) {
      if (!/^\d+$/.test(segments[i])) {
        return segments[i];
      }
    }
    return '';
  }

  // Helper: Returns the last two segments of a route.
  getLastTwoSegments(route: string): string {
    const segments = route.split('/').filter((segment) => segment !== '');
    return segments.slice(-2).join('/');
  }

  // Called when a row is clicked to update the iframes and snapshot image.
  onRowClick(row: any) {
    this.leftUrl = row.fullUrl1;
    this.rightUrl = row.fullUrl2;
    // Create safe URLs using DomSanitizer
    this.leftUrlSafe = this.sanitizer.bypassSecurityTrustResourceUrl(
      this.leftUrl,
    );
    this.rightUrlSafe = this.sanitizer.bypassSecurityTrustResourceUrl(
      this.rightUrl,
    );
    this.snapshotFile = row.snapshotFile;
    this.tableRows.forEach((x) => (x.lastClicked = false));
    row.lastClicked = true;
  }

  // Check if the snapshot file exists in assets/__diff_output__.
  checkSnapshotFile(row: CompareRow) {
    const url = `assets/__diff_output__/${row.filenameBase}`;
    // Use HEAD request to check if the file exists.
    this.http.head(url, { observe: 'response' }).subscribe(
      (response) => {
        // If the response is successful, mark snapshotExists as true.
        row.snapshotExists = true;
      },
      (error) => {
        // If error occurs (e.g. 404), mark as false.
        row.snapshotExists = false;
      },
    );
  }

  checkSnapshotFileSync(row: CompareRow) {
    const url = `assets/__diff_output__/${row.snapshotFile}`;
    try {
      const xhr = new XMLHttpRequest();
      // Open a synchronous request (third parameter = false)
      xhr.open('HEAD', url, false);
      xhr.send(null);
      // If the status is in the successful range, mark the file as existing.
      row.snapshotExists = xhr.status >= 200 && xhr.status < 400;
    } catch (e) {
      row.snapshotExists = false;
    }
  }

  updateLocalStorage() {
    const state: any = {};
    this.tableRows.forEach((row) => {
      state[row.snapshotName] = {
        reviewed: row.reviewed,
        error: row.error,
        notes: row.notes,
        image: row.snapshotName,
        fixed: row.fixed,
      };
    });
    localStorage.setItem('snapshotRowsState', JSON.stringify(state));
  }

  // Load the state from localStorage.
  loadLocalStorage() {
    const storedStateStr = localStorage.getItem('snapshotRowsState');
    if (storedStateStr) {
      const storedState = JSON.parse(storedStateStr);
      this.tableRows.forEach((row) => {
        if (storedState[row.snapshotName]) {
          row.reviewed = storedState[row.snapshotName].reviewed;
          row.error = storedState[row.snapshotName].error;
          row.notes = storedState[row.snapshotName].notes;
          row.fixed = storedState[row.snapshotName].fixed;
        }
      });
    }
  }

  // Download only the reviewed rows' state as a JSON file.
  downloadReviewedState() {
    const reviewedState: any = {};
    this.tableRows.forEach((row) => {
      if (row.reviewed) {
        reviewedState[row.snapshotName] = {
          reviewed: row.reviewed,
          error: row.error,
          notes: row.notes,
          fixed: row.fixed,
        };
      }
    });
    const dataStr = JSON.stringify(reviewedState, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reviewedState.json';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  clearState() {
    this.tableRows = this.buildSmallerTableRows();
    this.updateLocalStorage();
  }

  // Trigger the file input for uploading state.
  triggerFileInput() {
    this.fileInput.nativeElement.click();
  }

  // Handle file input change and update state.
  handleFileInput(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const json = JSON.parse(e.target.result);

          // Rebuild fresh rows first
          this.tableRows = this.buildSmallerTableRows();

          // Restore saved data
          this.tableRows.forEach((row) => {
            const saved = json[row.snapshotName];
            if (saved) {
              row.reviewed = saved.reviewed;
              row.error = saved.error;
              row.notes = saved.notes;
              row.fixed = saved.fixed;
            }
          });

          // Sort by index extracted from snapshotName like "12-snapshot"
          this.tableRows.sort((a, b) => {
            const getIndex = (s: string) => parseInt(s.split('-')[0], 10);
            return getIndex(a.snapshotName) - getIndex(b.snapshotName);
          });

          this.updateLocalStorage();
        } catch (error) {
          console.error('Invalid JSON file', error);
        }
      };
      reader.readAsText(file);
    }
  }

  ngAfterViewInit() {}
}

export interface CompareRow {
  route: string;
  routeName: string | null;
  snapshotName: string;
  snapshotFile: string;
  fullUrl1: string;
  fullUrl2: string;
  reviewed: boolean;
  error: boolean;
  notes: string;
  snapshotExists: boolean;
  filenameBase: string;
  lastClicked: boolean;
  fixed: boolean;
}
